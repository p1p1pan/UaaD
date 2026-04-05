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
