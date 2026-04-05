# Backend Core Foundations Implementation (BE-02 & BE-03)

This document walk-through covers the backend advancements for handling high concurrency and preventing registration spam on the UAAD platform.

## 🏗️ 1. Database Connection Pool Optimization (BE-02)
We have optimized how our Go backend interacts with the database to handle heavy concurrent traffic without locking issues.
- **Underlying SQL Connection Tuning**: We extracted the `*sql.DB` object from our GORM instance in `main.go`.
- **Concurrency Parameters**: 
  - `MaxOpenConns`: Set to **100** to allow significant parallel query execution.
  - `MaxIdleConns`: Set to **10** to keep a warm pool of active connections.
  - `ConnMaxLifetime`: Set to **1 hour** to recycle stale connections.

## 🛡️ 2. Registration Anti-Spam / Rate Limiting (BE-03)
To prevent malicious bots or scripts from flooding our registration endpoint, we implemented a custom IP-based rate limiter.
- **`RateLimitMiddleware`**: A newly created middleware in `backend/internal/middleware/rate_limit.go`.
- **Policy**: We allowing **5 registration attempts per minute** per unique IP address ($5/60$ tokens/sec with a burst of 5).
- **Graceful Rejection**: When a user (or bot) exceeds the limit, the server now responds with a standard **HTTP 429 Too Many Requests** and a clear JSON error message.

## ✅ Verification
We simulated a high-concurrency attack on the `/api/v1/auth/register` endpoint.
1. **Requests 1-5**: Successfully processed (returning 201 or 409).
2. **Requests 6+**: Verified that the server correctly identified the flood and returned **429 Too Many Requests**.

> [!NOTE]
> This rate limiter is currently in-memory. For a truly distributed UAAD deployment across multiple Kubernetes pods, this logic will eventually need to be migrated to a shared Redis cluster using Lua scripts to maintain global state.

---

# A 组后端1：活动 + 报名 + 订单���块实现

**日期：** 2026-04-04
**范围：** 13 个 API 端点，涵盖 Activity / Enrollment / Order 三大模块

## 1. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 修改 | `repository/activity_repository.go` | 新增 Sort ��序���持��DeductStock 乐观锁扣库存、IncrementStock 库存回补 |
| 新增 | `service/activity_service.go` | 活�� CRUD + DRAFT→PUBLISHED ��态机 + 时间/权限校验 |
| 新增 | `service/enrollment_service.go` | 报名幂等检查 + 乐观锁库存扣减 + 事务创建报名&订单 |
| 新增 | `service/order_service.go` | 订单列表/详情 + 模拟支付(PENDING→PAID) + 过期订单扫描&库存回补 |
| 新增 | `handler/activity_handler.go` | 7 个端��: Create/Update/Publish/List/Detail/Stock/MerchantList |
| 新增 | `handler/enrollment_handler.go` | 3 个端点: Create/GetStatus/List |
| 新增 | `handler/order_handler.go` | 3 个端点: List/Detail/Pay |
| 新增 | `handler/activity_routes.go` | RegisterActivityRoutes() — 公开+B端路由分离 |
| 新增 | `handler/enrollment_routes.go` | RegisterEnrollmentRoutes() — 全部需 JWT |
| 新增 | `handler/order_routes.go` | RegisterOrderRoutes() — 全部需 JWT |
| 修改 | `cmd/server/main.go` | AutoMigrate 补全 Activity/Enrollment/Order + DI 装配 + 路由��册 |

## 2. 关键设计决策

### 库存扣减 — 乐观锁
```sql
UPDATE activities SET enroll_count = enroll_count + 1
WHERE id = ? AND enroll_count < max_capacity AND status IN ('PUBLISHED','SELLING_OUT')
```
- 不使用 `SELECT FOR UPDATE` 悲观锁（PR checklist 明确禁止）
- `RowsAffected == 0` 时判定库存不足，无需重试
- 后续升级 Redis Lua 只需替换 repository 实现

### 报名事��
在一个 GORM Transaction ���完成三步：
1. 乐观锁扣库存
2. 创建 Enrollment（开发阶段直接 SUCCESS，预留 QUEUING）
3. 创建 Order（PENDING，30 分钟过期）

任一���失败自动回滚。

### 路由注册 — 模块隔离
每个模块独立 `_routes.go` 文件暴露 `RegisterXXXRoutes()` 函数，`main.go` 一次性调用，避免多人冲突。

`/activities/merchant` ��册在 `/:id` 之前，防止 Gin 把 "merchant" 匹配为 `:id` 参数。

### 订单号生成
`ORD` + `YYYYMMDD` + `8位 atomic 序列`，进程内唯一。生产环境需换 DB sequence。

## 3. 验证

```
go build ./...  → exit 0
go vet ./...    → exit 0
```

---

# 推荐模块第一阶段：L1/L2 落地（热度推荐 + 冷启动兜底）

**日期：** 2026-04-05  
**范围：** 推荐接口 2 个（`/recommendations`、`/recommendations/hot`）+ 热度评分重算任务 + 服务层单元测试

## 1. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `internal/repository/recommendation_repository.go` | 推荐查询模型、偏好分类查询、分数 upsert、rank 更新 |
| 新增 | `internal/service/recommendation_service.go` | 推荐策略分流（匿名/登录）、冷启动混排、5 分钟 TTL 缓存、L2 热度重算 |
| 新增 | `internal/handler/recommendation_handler.go` | `GET /recommendations`、`GET /recommendations/hot` 处理器 |
| 新增 | `internal/handler/recommendation_routes.go` | 推荐路由注册，采用 Optional JWT |
| 修改 | `cmd/server/main.go` | DI 注入推荐模块、注册路由、启动评分重算定时任务 |
| 新增 | `internal/service/recommendation_service_test.go` | 推荐服务单测（策略、缓存、重算） |
| 修改 | `tests/response_contract_test.go` | 新增 `/recommendations/hot` 黑盒响应契约测试 |
| 修改 | `task.md` | 新增 RE-L1-L2 任务与完成状态 |

## 2. 关键实现说明

### 2.1 接口与策略

- `GET /api/v1/recommendations`
  - 匿名用户：`strategy = hot_ranking`，返回热门 + 少量新上架兜底。
  - 登录用户（有行为）：`strategy = cold_fill`，优先按用户偏好分类召回，再用热门补齐。
  - 支持 `limit`、`offset`、`need_refresh=true`（绕过缓存）。

- `GET /api/v1/recommendations/hot`
  - 公开热门推荐接口，返回统一响应体中的 `list` 与 `total`。

### 2.2 L2 热度评分引擎

实现了文档约定的加权评分：

$$
score = w_v\cdot view\_score + w_e\cdot enroll\_score + w_s\cdot speed\_score - w_t\cdot time\_decay
$$

- 权重读取 `config.ScoringWeights`。
- 启动时执行一次全量重算；之后按 `SCORE_RECALC_MINUTES` 周期重算。
- 重算后刷新 `activity_scores.rank`，并清理推荐缓存。

### 2.3 缓存策略

- 当前采用进程内 TTL 缓存（5 分钟）键格式：`rec:{userID}:{limit}:{offset}`。
- `need_refresh=true` 时强制跳过缓存。
- 评分重算后统一清空缓存，避免旧分数长期驻留。

> 说明：文档目标是 Redis 缓存；本阶段先落地进程内缓存以尽快交付 API，后续可平滑替换为 Redis。

## 3. 测试与验证

执行结果：

```bash
go test ./internal/service/... -count=1
go test ./... -count=1
```

两条命令均通过，新增推荐服务单测与现有服务测试无回归失败。

---

# 推荐模块第二阶段：L3 协同过滤混排

**日期：** 2026-04-05  
**范围：** 协同过滤候选召回 + 混合推荐策略升级 + 单元测试扩展

## 1. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 修改 | `internal/repository/recommendation_repository.go` | 新增用户交互活动提取与基于共现的相似活动 SQL 查询 |
| 修改 | `internal/service/recommendation_service.go` | 增加 `collaborative_filtering` 分支（行为阈值 > 20），并混排 CF/Hot/Fresh |
| 修改 | `internal/service/recommendation_service_test.go` | 扩展 stub 接口，新增 L3 策略分支测试 |
| 修改 | `task.md` | 追加 RE-L3 任务与验证记录 |

## 2. 关键实现说明

### 2.1 协同过滤候选召回

- 先从 `user_behaviors` 中提取当前用户最近交互过的活动集合（seed）。
- 再通过共现 SQL 计算“与 seed 共同用户最多”的候选活动。
- 对候选活动再关联 `activities` 与 `activity_scores`，保证只返回 `PUBLISHED` 且按相关性 + 热度排序。

### 2.2 策略升级

- 用户行为条数 `> 20`：启用 `strategy = collaborative_filtering`。
- 用户行为条数 `1~20`：保持 `strategy = cold_fill`。
- 用户无行为：保持 `strategy = hot_ranking`。

### 2.3 混排逻辑

- L3 路径中使用协同过滤候选作为主召回源，再由热门与新上架补齐。
- 合并时按活动 ID 去重，确保列表无重复活动。
- 当协同过滤缺少 seed 时自动回落到 `cold_fill`，避免空列表。

## 3. 测试与验证

执行结果：

```bash
go test ./internal/service/... -count=1
go test ./... -count=1
```

两条命令均通过，L3 新增逻辑无编译错误且无全局回归。

---

# B 组后端2：推荐模块第三阶段：HTTP 测试与契约补强

**日期：** 2026-04-05  
**范围：** 推荐接口处理器测试 + 契约测试增强 + 全量回归验证

## 1. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `internal/handler/recommendation_handler_test.go` | 推荐接口 HTTP 层测试（参数、strategy、错误映射） |
| 修改 | `tests/response_contract_test.go` | 新增 `/recommendations` 响应中 `strategy` 字段断言 |
| 修改 | `task.md` | 追加 RE-Validation 阶段任务与验证结果 |

## 2. 测试覆盖点

- `GET /recommendations`
  - `limit/offset/need_refresh` 解析与透传
  - 返回体包含 `strategy`
  - 非法参数返回 400

- `GET /recommendations/hot`
  - 正常返回 200
  - 服务异常路径返回 500

- 契约层
  - 黑盒测试新增 `strategy` 类型断言，确保前端依赖字段稳定可用

## 3. 验证命令

```bash
go test ./internal/handler/... -count=1
go test ./internal/service/... -count=1
go test ./... -count=1
```

三条命令全部通过，推荐模块从实现到契约测试形成完整闭环。

---

# B 组后端2：推荐模块测试增强：覆盖更多边界与错误场景

**日期：** 2026-04-05  
**范围：** 推荐服务与处理器测试扩容，覆盖缓存、阈值、回退、错误路径

## 1. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 修改 | `internal/service/recommendation_service_test.go` | 新增参数校验、need_refresh 缓存绕过、阈值边界、CF 回退、重算错误路径测试 |
| 修改 | `internal/handler/recommendation_handler_test.go` | 新增 offset 非法、内部错误映射、匿名路径、hot 校验错误映射测试 |
| 修改 | `task.md` | 追加 RE-Test-Plus 阶段测试清单与验证结果 |

## 2. 主要新增覆盖点

- 服务层
  - `GetRecommendations` 与 `GetHotRecommendations` 的参数边界（`limit/offset`）
  - `need_refresh=true` 时缓存绕过行为
  - 行为阈值边界：`behavior_count == 20` 走 `cold_fill`
  - 协同过滤无 seed 的回退逻辑（回落到 `cold_fill`）
  - 评分重算异常路径：数据源错误、upsert 错误、rank 更新错误、上下文取消

- 处理器层
  - `offset` 非法输入返回 400
  - `/recommendations` 内部错误返回 500
  - 匿名请求确保不注入用户 ID
  - `/recommendations/hot` 的服务校验错误映射

## 3. 验证命令

```bash
go test ./internal/handler/... -count=1
go test ./internal/service/... -count=1
go test ./... -count=1
```

三条命令均通过，推荐模块测试覆盖面较之前显著提升。

---

# B 组后端2：通知 + 行为埋点 + 基础设施

**日期：** 2026-04-05  
**范围：** 通知 3 个 HTTP 端点 + 行为埋点 2 个端点；配置与 `-tags=bgroup` 黑盒测试  
**详细文档：** `.agents/workflows/backend/b-group.md`

## 1. 文件变更清单

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `domain/notification.go`、`domain/behavior.go` | 实体 |
| 新增 | `repository/notification_repository.go`、`repository/behavior_repository.go` | 持久化 |
| 新增 | `service/notification_service.go`、`service/behavior_service.go` | 读接口与 Notify* / 埋点写入 |
| 新增 | `handler/notification_handler.go`、`handler/notification_routes.go` | 通知路由 |
| 新增 | `handler/behavior_handler.go`、`handler/behavior_routes.go` | 行为路由 |
| 新增 | `service/notification_service_test.go`、`service/behavior_service_test.go` | 单元测试 |
| 新增 | `tests/task_env_test.go` | 共用 TestMain、openTestDB、连接池（integration / stress / bgroup） |
| 新增 | `tests/bgroup_integration_test.go`、`tests/jwt_test.go`、`tests/response_contract_test.go` | 黑盒（`-tags=bgroup`） |
| 修改 | `internal/config/config.go` | 连接池 env + `ApplyMySQLPool` |
| 修改 | `cmd/server/main.go`、`scripts/seed/main.go` | 注册路由 / 连接池与线上一致 |

## 2. 关键设计

- **通知**：HTTP 列表、未读数、已读；`Notify*` 为 best-effort；与业务流接线见 `docs/SYSTEM_DESIGN.md` §4.9。
- **行为埋点**：单条与批量、参数校验、批量上限；可配置同步/异步写入。

## 3. 验证

```bash
cd backend
go test ./internal/service/ -run 'Notification|Behavior' -count=1
go test -v -tags=bgroup -count=1 ./tests/
```

```
go build ./...  → exit 0
go vet ./...    → exit 0
```
