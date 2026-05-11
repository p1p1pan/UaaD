# Enrollment 规范增量

## MODIFIED Requirements

### Requirement: 主动取消报名

系统 MUST 允许用户主动终止自己的排队状态，或取消尚未支付的报名，并立即触发容量回补机制，让其他参与者可以继续获取库存。

#### Scenario: 用户在排队中主动取消
- GIVEN 用户存在一条状态为 `QUEUING` 的报名记录
- WHEN 用户发送主动取消请求
- THEN 系统将报名状态更新为 `CANCELLED`
- AND 回补这次尝试对应的临时库存锁
- AND 将该用户从活跃处理队列中移除

#### Scenario: 用户取消未支付的待处理订单
- GIVEN 用户有一条报名已经映射到状态为 `PENDING` 的订单
- WHEN 用户发送主动取消请求
- THEN 系统将订单状态更新为 `CLOSED`
- AND 将关联报名状态更新为 `CANCELLED`
- AND 回补活动库存
- AND 清除本次交易对应的临时库存锁

#### Scenario: 用户尝试取消已支付订单
- GIVEN 用户有一条报名已经映射到状态为 `PAID` 的订单
- WHEN 用户发送主动取消请求
- THEN 系统拒绝该取消请求
- AND 返回错误，说明已完成支付的交易不能通过当前基础流程取消
