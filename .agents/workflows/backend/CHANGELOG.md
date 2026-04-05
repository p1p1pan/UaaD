---
description: "后端改动总览：所有 AI Agent 对 backend/ 的变更记录"
---

# Backend 变更记录

## 2026-04-04 — A 组后端1 完整实现

**执行者：** Claude Code (Opus 4.6)
**详细文档：** [a-group.md](a-group.md)

### 新增/修改文件（共 20 个文件）

#### Service 层（3 个新文件）
- `internal/service/activity_service.go` — 活动 CRUD + 状态机
- `internal/service/enrollment_service.go` — 报名幂等 + 乐观锁事务
- `internal/service/order_service.go` — 订单 + 模拟支付 + 过期扫描

#### Handler 层（6 个新文件）
- `internal/handler/activity_handler.go` — 7 个端点
- `internal/handler/enrollment_handler.go` — 3 个端点
- `internal/handler/order_handler.go` — 3 个端点
- `internal/handler/activity_routes.go` — RegisterActivityRoutes()
- `internal/handler/enrollment_routes.go` — RegisterEnrollmentRoutes()
- `internal/handler/order_routes.go` — RegisterOrderRoutes()

#### Repository 层（1 个修改）
- `internal/repository/activity_repository.go` — 新增 Sort/DeductStock/IncrementStock

#### 入口（1 个修改）
- `cmd/server/main.go` — AutoMigrate + DI + Routes + 订单过期定时器

#### 测试（6 个新文件）
- `internal/service/activity_service_test.go` — 单元: 状态机/时间/字段锁
- `internal/service/order_service_test.go` — 单元: 订单号格式/唯一/并发
- `pkg/jwtutil/jwt_test.go` — 单元: Token 签发/解析/过期
- `pkg/response/response_test.go` — 单元: 响应格式/错误码
- `tests/integration_test.go` — 集成: 并发抢票/幂等/库存/权限/支付
- `tests/stress_test.go` — 压力: Benchmark + 500并发

#### 前端修复（3 个修改）
- `frontend/src/pages/Login.tsx` — 响应结构适配
- `frontend/src/pages/Register.tsx` — 错误字段适配
- `frontend/.env` — Mock 关闭

#### 配置/文档
- `CLAUDE.md` — Claude Code 全局指令
- `backend/walkthrough_backend.md` — 变更履历
- `cmd/server/main.go` CORS → AllowAllOrigins（开发阶段）

### 测试结果

| 类型 | 数量 | 命令 | 结果 |
|---|---|---|---|
| 单元测试 | 19 | `go test ./internal/service/ ./pkg/...` | PASS |
| 集成测试 | 5 | `go test -tags=integration ./tests/` | PASS |
| 并发验证 | 100并发 stock=1 | 集成测试内 | 恰好 1 成功 |
| Build | — | `go build ./...` | exit 0 |
| Vet | — | `go vet ./...` | exit 0 |

---

## 2026-04-05 — B 组后端2：通知、行为埋点、配置与黑盒测试

**详细文档：** [b-group.md](b-group.md)

### 新增/修改文件（共 22 个文件）

#### Domain 层（2 个新文件）
- `internal/domain/notification.go` — 通知实体
- `internal/domain/behavior.go` — 行为埋点实体

#### Repository 层（2 个新文件）
- `internal/repository/notification_repository.go` — 列表/未读/插入
- `internal/repository/behavior_repository.go` — 单条与批量写入

#### Service 层（2 个新文件）
- `internal/service/notification_service.go` — 读接口 + `Notify*` 写入（best-effort）
- `internal/service/behavior_service.go` — 校验与写入（同步/异步可配）

#### Handler 层（4 个新文件）
- `internal/handler/notification_handler.go` — GET 列表、GET unread-count、PUT read
- `internal/handler/notification_routes.go` — RegisterNotificationRoutes()
- `internal/handler/behavior_handler.go` — POST `/behaviors`、`/behaviors/batch`
- `internal/handler/behavior_routes.go` — RegisterBehaviorRoutes()

#### 配置与入口（3 个修改）
- `internal/config/config.go` — `DB_MAX_IDLE_CONNS` / `DB_MAX_OPEN_CONNS` / `DB_CONN_MAX_LIFETIME`；`ApplyMySQLPool`
- `cmd/server/main.go` — 注册通知与行为路由；连接池 `cfg.ApplyMySQLPool`
- `scripts/seed/main.go` — 连接池与线上一致

#### 测试（6 个新文件）
- `internal/service/notification_service_test.go` — 单元: 分页/已读/Notify*
- `internal/service/behavior_service_test.go` — 单元: 校验/批量/同步写入
- `tests/task_env_test.go` — 共用: TestMain、openTestDB、连接池（`integration` \| `stress` \| `bgroup`）
- `tests/bgroup_integration_test.go` — 黑盒: 并发/幂等/库存/权限/支付
- `tests/jwt_test.go` — 黑盒: JWT 中间件
- `tests/response_contract_test.go` — 黑盒: 统一响应信封

#### 配置/文档（仓库级）
- `docs/SYSTEM_DESIGN.md` — §4.8 行为、§4.9 通知等
- `docs/SPRINT1.md` — B 组分工与 `bgroup` 说明
- `backend/walkthrough_backend.md` — B 组实现与验证
- `.agents/workflows/backend/b-group.md` — B 组工作流

### 测试结果

| 类型 | 数量 | 命令 | 结果 |
|---|---|---|---|
| B 组单元测试 | 13 | 详见 [b-group.md](b-group.md)「测试运行方式」 | PASS |
| B 组黑盒测试 | 20+ | `go test -tags=bgroup -count=1 ./tests/`（需 MySQL + seed + 服务） | PASS |
| Build | — | `go build ./...` | exit 0 |
| Vet | — | `go vet ./...` | exit 0 |
