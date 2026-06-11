# 设计：新增报名取消能力

## 技术方案
我们将提供一个接口 `POST /api/v1/enrollments/{id}/cancel`，从用户视角统一处理“取消排队”和“取消未支付订单”两种场景。
后端会根据当前状态判断这条报名是 `QUEUING`，还是已经映射成 `PENDING` 订单，并执行对应的安全取消逻辑。

## 架构决策

### Decision: `QUEUING` 状态复用 StockEngine 回滚逻辑
如果报名仍处于 `QUEUING`，我们只需要将其状态更新为 `CANCELLED`，并调用 `StockEngine.Rollback` 释放 Redis 中占用的容量槽位。

### Decision: 使用乐观锁安全更新订单状态
如果报名已经映射到一笔 `PENDING` 订单，我们必须避免 Time-of-Check to Time-of-Use（TOCTOU）问题。我们会在 `OrderRepository` 中实现 `UpdateStatusFromPending`，使用标准的行级条件更新：
`UPDATE orders SET status = 'CLOSED' WHERE id = ? AND status = 'PENDING'`.
只有当 `RowsAffected == 1` 时，才继续调用 MySQL `IncrementStock` 和 Redis `Rollback`。这样可以避免 `Pay()`、`ScanExpired()` 和 `Cancel()` 并发碰撞时重复回补库存的问题。

### Decision: 前端交互位置
前端会在“排队中”或“立即支付”等动作附近提供一个简单的“取消”按钮。点击后调用取消接口，并刷新最新状态。

## 涉及文件
- `backend/internal/repository/order_repository.go`：新增 `UpdateStatusFromPending`
- `backend/internal/service/order_service.go`：在 `ScanExpired` 和 `Pay` 中复用新的安全更新逻辑，并补充取消入口
- `backend/internal/service/enrollment_service.go`：实现主动取消逻辑
- `backend/internal/handler/enrollment_handler.go`：暴露 `POST /enrollments/:id/cancel`
- `frontend/src/api/endpoints/enrollments.ts`：新增 `cancelEnrollment` API 封装
- `frontend/src/pages/Orders.tsx` / `ActivityDetail.tsx`：在界面中接入取消动作
