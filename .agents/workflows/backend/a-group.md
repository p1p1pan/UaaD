---
description: "A组后端1 开发工作流：活动+报名+订单模块的实现规范、测试策略、已完成清单"
---

# A 组后端1 开发工作流 (backend-a-group)

## 1. 已完成工作清单

### 1.1 代码文件

| 操作 | 文件 | 说明 |
|---|---|---|
| 修改 | `repository/activity_repository.go` | 新增 Sort 排序、DeductStock 乐观锁扣库存、IncrementStock 库存回补 |
| 新增 | `service/activity_service.go` | 7 个方法: Create/Update/Publish/List/Detail/Stock/MerchantList |
| 新增 | `service/enrollment_service.go` | 3 个方法: Create(事务+乐观锁)/GetStatus/ListByUser |
| 新增 | `service/order_service.go` | 4 个方法: ListByUser/Detail/Pay/ScanExpired |
| 新增 | `handler/activity_handler.go` | 7 个 API 端点 |
| 新增 | `handler/enrollment_handler.go` | 3 个 API 端点 |
| 新增 | `handler/order_handler.go` | 3 个 API 端点 |
| 新增 | `handler/activity_routes.go` | RegisterActivityRoutes() |
| 新增 | `handler/enrollment_routes.go` | RegisterEnrollmentRoutes() |
| 新增 | `handler/order_routes.go` | RegisterOrderRoutes() |
| 修改 | `cmd/server/main.go` | AutoMigrate 3 实体 + DI 装配 + 路由注册 + 订单过期扫描定时器 |

### 1.2 测试文件

| 文件 | 类型 | Build Tag | 内容 |
|---|---|---|---|
| `internal/service/activity_service_test.go` | 单元测试 | 无 | 状态机、时间校验、字段锁定、Tags 序列化 |
| `internal/service/order_service_test.go` | 单元测试 | 无 | 订单号格式、唯一性、并发安全 |
| `pkg/jwtutil/jwt_test.go` | 单元测试 | 无 | Token 签发/解析/过期/错误密钥 |
| `pkg/response/response_test.go` | 单元测试 | 无 | 所有响应码 + 分页格式 |
| `tests/integration_test.go` | 集成测试 | `integration` | 并发抢票/幂等/库存不足/权限/支付 |
| `tests/stress_test.go` | 压力测试 | `stress` | Benchmark 吞吐量 + 500并发抢10票 |

### 1.3 前端修复

| 文件 | 修改 |
|---|---|
| `frontend/src/pages/Login.tsx` | `response.data.token` → `response.data.data.token`; 错误字段 `error` → `message` |
| `frontend/src/pages/Register.tsx` | 错误字段 `error` → `message` |
| `frontend/.env` | `VITE_USE_MOCK=true` → `false` |

---

## 2. 测试运行方式

```bash
cd backend

# 单元测试（不需要服务器，随时跑）
go test -v ./internal/service/ ./pkg/jwtutil/ ./pkg/response/

# 集成测试（需要服务器 + seed 数据）
go run ./scripts/seed
go run ./cmd/server &
go test -v -tags=integration -count=1 ./tests/

# 压力测试 / Benchmark
go test -v -tags=stress -bench=. -benchtime=10s -count=1 ./tests/
```

---

## 3. 13 个 API 端点

| # | 方法 | 路径 | 认证 | 逻辑 |
|---|---|---|---|---|
| 1 | POST | `/activities` | JWT+MERCHANT | 创建活动(DRAFT) |
| 2 | PUT | `/activities/:id` | JWT+MERCHANT+owner | 更新(PUBLISHED后禁改库存/开票时间) |
| 3 | PUT | `/activities/:id/publish` | JWT+MERCHANT | DRAFT→PUBLISHED |
| 4 | GET | `/activities` | 公开 | 分页+category/keyword/sort(hot/recent/soon) |
| 5 | GET | `/activities/:id` | 公开 | 详情 |
| 6 | GET | `/activities/:id/stock` | 公开 | 实时库存(DB) |
| 7 | GET | `/activities/merchant` | JWT+MERCHANT | 商户活动列表 |
| 8 | POST | `/enrollments` | JWT | 报名(幂等+乐观锁+事务) |
| 9 | GET | `/enrollments/:id/status` | JWT | 报名状态 |
| 10 | GET | `/enrollments` | JWT | 我的报名列表 |
| 11 | GET | `/orders` | JWT | 我的订单列表 |
| 12 | GET | `/orders/:id` | JWT | 订单详情 |
| 13 | POST | `/orders/:id/pay` | JWT | 模拟支付 PENDING→PAID |

---

## 4. 关键设计决策

### 4.1 库存扣减 — 乐观锁

```sql
UPDATE activities SET enroll_count = enroll_count + 1
WHERE id = ? AND enroll_count < max_capacity AND status IN ('PUBLISHED','SELLING_OUT')
```

- 不使用 SELECT FOR UPDATE（PR checklist 明确禁止）
- RowsAffected == 0 → 库存不足
- 后续升级 Redis Lua 只需替换 repository 实现

### 4.2 报名事务

一个 GORM Transaction 完成：
1. 乐观锁扣库存
2. 创建 Enrollment（开发阶段直接 SUCCESS）
3. 创建 Order（PENDING，15 分钟过期）

### 4.3 订单过期扫描

`main.go` 中 `time.Ticker` 每 5 分钟执行 `ScanExpired()`：
- 查找 `status='PENDING' AND expired_at < NOW()`
- 状态改 CLOSED + enroll_count 回补

### 4.4 路由注册

每个模块独立 `_routes.go`，暴露 `RegisterXXXRoutes()`。
`/activities/merchant` 注册在 `/:id` 之前，防止 Gin 匹配 "merchant" 为 `:id`。

### 4.5 订单号

`ORD` + `YYYYMMDD` + `8位 atomic 序列`。进程内唯一，生产环境需换 DB sequence。

---

## 5. 测试验证结果

### 单元测试
```
ok  internal/service    — 8 tests PASS
ok  pkg/jwtutil         — 4 tests PASS
ok  pkg/response        — 7 tests PASS
```

### 集成测试
```
✅ 并发抢票: stock=1, 100 并发, 成功=1, 失败=99 → 零超卖
✅ 报名幂等: 重复报名返回 409
✅ 库存不足: 售罄后 code=1101
✅ 权限校验: 普通用户创建活动 403
✅ 模拟支付: PENDING → PAID
```

### CI 检查
```
go build ./...  → exit 0
go vet ./...    → exit 0
```

---

## 6. 后续优化方向

| 方向 | 现状 | 优化 |
|---|---|---|
| 数据库 | SQLite | 切 MySQL（`gorm.io/driver/mysql`） |
| 库存扣减 | MySQL 乐观锁 | Redis Lua 原子操作 |
| 测试 | 手动 mock | 引入 testify/mock |
| 日志 | `log` 标准库 | 结构化日志 `slog`/`zap` |
| API 文档 | 手写 Markdown | Swagger (`swaggo/swag`) |
| 错误处理 | handler 内 switch | 公共 error→response 中间件 |
