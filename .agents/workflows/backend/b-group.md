---
description: "B 组后端2 全模块集成说明：通知、行为埋点、推荐、连接池与 bgroup 测试（清单/API/设计/验证）"
---

# B 组后端2 开发工作流 (backend-b-group)

## 1. 已完成工作清单

### 1.1 代码文件

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `domain/notification.go` | 通知实体 |
| 新增 | `domain/behavior.go` | 行为埋点实体 |
| 新增 | `repository/notification_repository.go` | 列表、未读数、插入 |
| 新增 | `repository/behavior_repository.go` | 单条与批量写入 |
| 新增 | `repository/recommendation_repository.go` | 热度/新鲜/协同/分类与评分；`activity_scores.rank` 对 MySQL 使用反引号 |
| 新增 | `service/notification_service.go` | 列表、已读、`Notify*` 写入（best-effort） |
| 新增 | `service/behavior_service.go` | 校验、同步/异步写入开关 |
| 新增 | `service/recommendation_service.go` | L1/L2/L3 策略分流、TTL 缓存、`RecalculateAllScores` |
| 新增 | `handler/notification_handler.go` | GET 列表、GET unread-count、PUT read |
| 新增 | `handler/notification_routes.go` | `RegisterNotificationRoutes` |
| 新增 | `handler/behavior_handler.go` | POST `/behaviors`、`/behaviors/batch` |
| 新增 | `handler/behavior_routes.go` | `RegisterBehaviorRoutes` |
| 新增 | `handler/recommendation_handler.go` | `GET /recommendations`、`/recommendations/hot` |
| 新增 | `handler/recommendation_routes.go` | `RegisterRecommendationRoutes`（Optional JWT） |
| 修改 | `internal/config/config.go` | MySQL 连接池 env、`ApplyMySQLPool`、评分权重等 |
| 修改 | `cmd/server/main.go` | 注册通知/行为/推荐路由、连接池、推荐评分定时任务 |
| 修改 | `scripts/seed/main.go` | 连接池与线上一致 |

### 1.2 测试文件

| 文件 | 类型 | Build Tag | 内容 |
|---|---|---|---|
| `internal/service/notification_service_test.go` | 单元测试 | 无 | 分页、已读、未读数、`Notify*` |
| `internal/service/behavior_service_test.go` | 单元测试 | 无 | 参数校验、批量上限、同步写入 |
| `internal/service/recommendation_service_test.go` | 单元测试 | 无 | 策略、缓存、`need_refresh`、重算异常路径 |
| `internal/handler/recommendation_handler_test.go` | 单元测试 | 无 | List/Hot、参数与错误映射 |
| `tests/task_env_test.go` | 共用环境 | `integration` \| `stress` \| `bgroup` | `TestMain`、`openTestDB`、`ApplyMySQLPool` |
| `tests/bgroup_integration_test.go` | 黑盒集成 | `bgroup` | 活动/报名/订单场景 + 推荐业务断言 |
| `tests/jwt_test.go` | 黑盒 | `bgroup` | JWT 中间件各分支 |
| `tests/response_contract_test.go` | 黑盒 | `bgroup` | 统一响应信封（含推荐路径） |

---

## 2. 测试运行方式

```bash
cd backend

# B 组单元测试（不需要 HTTP 服务）
go test -v ./internal/service/ -run 'Notification|Behavior|Recommendation' -count=1
go test -v ./internal/handler/ -run 'Recommendation' -count=1

# B 组黑盒（需要 MySQL + 先 seed + 服务已启动，默认 :8080）
go run ./scripts/seed
go run ./cmd/server
# 另开终端：
go test -v -tags=bgroup -count=1 ./tests/

# 子集
go test -v -tags=bgroup -run '^TestJWT' -count=1 ./tests/
go test -v -tags=bgroup -run '^TestResponse' -count=1 ./tests/
go test -v -tags=bgroup -run '^TestBGroup' -count=1 ./tests/
```

---

## 3. 7 个 B 组 API 端点

| # | 方法 | 路径 | 认证 | 逻辑 |
|---|---|---|---|---|
| 1 | GET | `/notifications` | JWT | 我的通知分页列表 |
| 2 | GET | `/notifications/unread-count` | JWT | 未读条数 |
| 3 | PUT | `/notifications/:id/read` | JWT | 标记已读 |
| 4 | POST | `/behaviors` | JWT | 单条行为埋点 |
| 5 | POST | `/behaviors/batch` | JWT | 批量埋点（有上限） |
| 6 | GET | `/recommendations` | Optional JWT | 个性化推荐（匿名/登录策略分流） |
| 7 | GET | `/recommendations/hot` | 无强制 JWT | 热门列表 |

统一响应与错误码见 `docs/SYSTEM_DESIGN.md` §4.2；通知与业务接线见 §4.9。

---

## 4. 关键设计决策

### 4.1 通知写入

- `NotificationService.Notify*` 为 **best-effort**：落库失败记日志，不向上抛错，避免拖垮报名/订单主事务。
- 与 `EnrollmentService` / `OrderService` 的接线在 `SYSTEM_DESIGN.md` §4.9 表中维护状态。

### 4.2 行为埋点

- 校验 `type`、活动 id；批量有大小上限。
- 可通过配置选择同步或异步写入（见 `config`）。

### 4.3 连接池

- `DB_MAX_IDLE_CONNS`、`DB_MAX_OPEN_CONNS`、`DB_CONN_MAX_LIFETIME`（Go `ParseDuration`，如 `1h`）与 `cmd/server`、`scripts/seed`、`tests/task_env_test.go` 共用。

### 4.4 推荐模块

- **策略**：匿名 `hot_ranking`；登录用户行为数 0 同匿名；1～20 为 `cold_fill`；>20 为 `collaborative_filtering`；协同无 seed 时回落 `cold_fill`。
- **热度评分**：加权组合浏览、报名比、速度、时间衰减（权重 `config.ScoringWeights`），周期重算写入 `activity_scores` 并更新 `rank`，重算后清空推荐缓存。
- **缓存**：进程内 TTL（约 5 分钟）；`need_refresh=true` 绕过缓存。

---

## 5. 测试验证结果

### 单元测试

含通知、行为、推荐 `service`/`handler` 相关用例；`go test ./internal/service/ ...`、`./internal/handler/ ...` 通过。

### 黑盒测试（`-tags=bgroup`）

需 MySQL、seed、服务监听 `:8080`：`bgroup_integration_test`、`jwt_test`、`response_contract_test` 通过。

### CI 检查

```
go build ./...  → exit 0
go vet ./...    → exit 0
```

---

## 6. 后续优化方向

| 方向 | 说明 |
|---|---|
| 通知与业务接线 | 在报名/订单/活动流程中按需调用 `Notify*`，与活动/订单等主流程联调 |
| 推荐缓存 | 进程内 TTL 可替换为 Redis |
| 黑盒 CI | 可选 Docker Compose 起 MySQL + 一键跑 `bgroup` |

---

## 7. 文档说明

本工作流**汇总 B 组后端2 已集成的全部模块**：通知（读接口与 `Notify*`）、行为埋点、个性化推荐（策略、评分重算与缓存）、MySQL 连接池与 `-tags=bgroup` 测试。文件清单、API 表、关键设计与验证命令均覆盖上述能力，作为 B 组交付的一站式查阅入口。
