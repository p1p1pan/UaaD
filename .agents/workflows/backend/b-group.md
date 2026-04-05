---
description: "B 组后端2 开发工作流：通知 + 行为埋点 + 基础设施（response/config/测试）"
---

# B 组后端2 开发工作流 (backend-b-group)

## 1. 已完成工作清单

### 1.1 代码文件

| 操作 | 文件 | 说明 |
|---|---|---|
| 新增 | `internal/domain/notification.go` | 通知实体 |
| 新增 | `internal/repository/notification_repository.go` | 通知列表/未读数/插入 |
| 新增 | `internal/service/notification_service.go` | 列表、已读、`Notify*` 写入（best-effort） |
| 新增 | `internal/handler/notification_handler.go` | GET 列表、GET unread-count、PUT read |
| 新增 | `internal/handler/notification_routes.go` | `RegisterNotificationRoutes` |
| 新增 | `internal/domain/behavior.go` | 行为埋点实体 |
| 新增 | `internal/repository/behavior_repository.go` | 写入单条/批量 |
| 新增 | `internal/service/behavior_service.go` | 校验、同步/异步写入开关 |
| 新增 | `internal/handler/behavior_handler.go` | POST `/behaviors`、`/behaviors/batch` |
| 新增 | `internal/handler/behavior_routes.go` | `RegisterBehaviorRoutes` |
| 修改 | `internal/config/config.go` | MySQL 连接池从 env（`DB_MAX_*`、`DB_CONN_MAX_LIFETIME`）+ `ApplyMySQLPool` |
| 修改 | `cmd/server/main.go` | 注册通知/行为路由；连接池走 `cfg.ApplyMySQLPool` |
| 修改 | `scripts/seed/main.go` | 连接池与线上一致 |

### 1.2 测试文件

| 文件 | 类型 | Build Tag | 内容 |
|---|---|---|---|
| `internal/service/notification_service_test.go` | 单元测试 | 无 | 分页、已读、未读数、`Notify*` 写入 |
| `internal/service/behavior_service_test.go` | 单元测试 | 无 | 参数校验、批量上限、同步写入 |
| `tests/task_env_test.go` | 共用环境 | `integration` \| `stress` \| `bgroup` | `TestMain` 加载 `.env`；`openTestDB`；`ApplyMySQLPool` |
| `tests/bgroup_integration_test.go` | 黑盒集成 | `bgroup` | 并发抢票、上架、幂等、库存码、权限、支付（与 A 组 `integration` 并行、独立辅助函数） |
| `tests/jwt_test.go` | 黑盒 | `bgroup` | JWT 中间件 `Authorization` 各分支 |
| `tests/response_contract_test.go` | 黑盒 | `bgroup` | 统一响应信封与常见业务码 |

---

## 2. 测试运行方式

```bash
cd backend

# B 组单元测试（不需要 HTTP 服务）
go test -v ./internal/service/ -run 'Notification|Behavior' -count=1

# B 组黑盒（需要 MySQL + 先 seed + 服务已启动）
go run ./scripts/seed
go run ./cmd/server
# 另开终端：
go test -v -tags=bgroup -count=1 ./tests/

# 仅跑 JWT 或 response 子集
go test -v -tags=bgroup -run '^TestJWT' -count=1 ./tests/
go test -v -tags=bgroup -run '^TestResponse' -count=1 ./tests/
go test -v -tags=bgroup -run '^TestBGroup' -count=1 ./tests/
```

---

## 3. B 组相关 API 端点

| # | 方法 | 路径 | 认证 | 逻辑 |
|---|---|---|---|---|
| 1 | GET | `/notifications` | JWT | 我的通知分页列表 |
| 2 | GET | `/notifications/unread-count` | JWT | 未读条数 |
| 3 | PUT | `/notifications/:id/read` | JWT | 标记已读 |
| 4 | POST | `/behaviors` | JWT | 单条行为埋点 |
| 5 | POST | `/behaviors/batch` | JWT | 批量埋点（有上限） |

统一响应与错误码见 `docs/SYSTEM_DESIGN.md`；通知写入方法见 §4.9（业务侧调用关系以联调为准）。

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

---

## 5. 测试验证结果（参考）

| 类型 | 命令 | 预期 |
|---|---|---|
| 单元 | `go test ./internal/service/ -run 'Notification|Behavior'` | PASS |
| 黑盒 | `go test -tags=bgroup ./tests/` | PASS（需服务+seed） |
| 构建 | `go build ./...` | exit 0 |

---

## 6. 后续优化方向

| 方向 | 说明 |
|---|---|
| 通知与业务接线 | 在报名/订单/活动流程中按需调用 `Notify*`，与 A 组联调 |
| 推荐模块 | `GET /recommendations/*` 等（若 Sprint 范围包含） |
| 黑盒 CI | 可选 Docker Compose 起 MySQL + 一键跑 `bgroup` |
