# UAAD 抢票引擎技术方案

**阶段：** Layer 1 核心链路
**更新日期：** 2026-04-01

---

## 1. 一句话核心思路

> **Redis Lua 原子扣减库存 → 返回排队号 → Kafka 异步落盘生成订单 → 前端轮询或 WS 推送结果**

整个链路 DB 不参与抢票决策，只做最终记录。DB 的写入速度不影响抢票吞吐量。

---

## 2. 完整数据流（时序图）

```
用户点击"抢票"
    │
    ▼
[1] 前端 → POST /api/v1/enrollments { activity_id: 3 }
    │
    ▼
[2] Gateway 层（Gin）
    ├─ JWT 鉴权中间件 → 拦截未登录
    ├─ IP 限流中间件 → 拦截 恶意 IP（已有）
    └─ 用户级限流 → Redis GET rate:user:{uid}:{activity_id}
                     若 ≥ 10 次/小时 → 429 Too Many Requests
    │
    ▼
[3] Enrollment Service
    ├─ 活动存在性校验（DB 查询，加缓存）
    ├─ 活动状态校验：status ∈ {PUBLISHED, SELLING_OUT}
    ├─ 时间窗口校验：enroll_open_at ≤ now ≤ enroll_close_at
    └─ 防重复报名校验：Redis SISMEMBER activity:{id}:enrolled_set {user_id}
    │
    ▼
[4] Redis Lua 原子扣减（核心防线 🔑）
    EVALSHA <sha1> 2 activity:{id}:stock activity:{id}:enrolled_set {user_id}
    │
    ├─ 返回值 ≥ 1  → 扣减成功，返回排队位置
    ├─ 返回值 = -1 → 库存不足 → 返回 410 "已售罄"
    └─ 返回值 = -2 → 已报名   → 返回 409 "请勿重复报名"
    │
    ▼
[5] 生成报名记录 + 入 Kafka
    ├─ DB INSERT enrollments (status='QUEUING', queue_position=返回值)
    │   └─ 这里只有一条 INSERT，不涉及库存计算，不怕并发
    ├─ Kafka 发送消息到 enrollment_requests topic
    │   └─ { user_id, activity_id, enrollment_id, timestamp }
    └─ 返回前端 202 Accepted + queue_position + estimated_wait
    │
    ▼
[6] 前端进入排队动画页
    ├─ 每 3~5 秒轮询 GET /api/v1/enrollments/:id/status
    ├─ （可选 v1.0）WebSocket 推送状态变化后停止轮询
    └─ 排队进度条 = current_position / initial_position
    │
    ▼
[7] Order Worker（异步消费 Kafka）
    ├─ 从 enrollment_requests topic 拉取批量消息（batch_size=100）
    ├─ 对每条消息：
    │   ├─ UPDATE enrollments SET status='SUCCESS', finalized_at=NOW()
    │   ├── INSERT orders (status='PENDING', expired_at=now+15min)
    │   ├─ UPDATE activities SET enroll_count=enroll_count+1
    │   ├─ 写入 notification (type='ENROLL_SUCCESS')
    │   └─ 若唯一键冲突（极少情况）：
    │       ├─ UPDATE enrollments SET status='FAILED'
    │       ├─ Redis DEL activity:{id}:enrolled_set {user_id}  ← 冲正
    │       ├─ Redis INCR activity:{id}:stock                  ← 补偿库存
    │       └─ 写入 notification (type='ENROLL_FAIL')
    └─ 提交 Kafka offset（保证至少一次消费）
```

---

## 3. Lua 原子扣减脚本（生产级）

```lua
-- KEYS[1] = activity:{id}:stock  (剩余库存)
-- KEYS[2] = activity:{id}:enrolled_set  (已报名用户 Set)
-- ARGV[1] = user_id (字符串格式)
-- ARGV[2] = enrollment_id (前端回显用)

-- 第 1 步：幂等检查 —— 用户是否已报名
local already_enrolled = redis.call('SISMEMBER', KEYS[2], ARGV[1])
if already_enrolled == 1 then
    return -2  -- 已报名
end

-- 第 2 步：库存检查
local stock = tonumber(redis.call('GET', KEYS[1]))
if stock == nil or stock <= 0 then
    return -1  -- 库存不足
end

-- 第 3 步：原子扣减（-1）+ 标记用户
redis.call('DECRBY', KEYS[1], 1)
redis.call('SADD', KEYS[2], ARGV[1])

-- 第 4 步：排队位置（全局递增）
local position = redis.call('INCR', 'activity:queue:global:counter')

return position  -- 返回排队位置（≥1 表示成功）
```

**返回值契约：**
| 返回值 | 含义 | HTTP 响应 |
|---|---|---|
| ≥ 1 | 扣减成功，排队位置 = 返回值 | `202 Accepted` → 进入排队 |
| -1 | 库存为零 | `410 Gone` → 已售罄 |
| -2 | 重复报名 | `409 Conflict` → 勿重复 |

**为什么这样设计：**
- Redis **单线程执行 Lua**，天然串行 → 不需要任何锁机制
- `SISMEMBER + SADD` 在同一事务内 → 不会漏报名/重复报名
- `DECRBY` + `SADD` 在同一 Lua 内 → 库存扣减和用户标记原子完成
- 如果后续 Worker 失败 → Lua 不依赖 DB → 不影响抢票吞吐量

---

## 4. 库存预热与预热时机

### 预热触发条件

商户调用 `PUT /activities/:id/publish` 上架活动时：

```go
// ActivityService.Publish()
func (s *ActivityService) PublishActivity(ctx context.Context, id uint64) error {
    // 1. 校验状态
    activity, err := s.repo.FindByID(id)
    if activity.Status != "DRAFT" && activity.Status != "PREHEAT" {
        return ErrInvalidPublishState
    }
    
    // 2. DB 状态更新
    activity.Status = "PUBLISHED"
    s.repo.Update(activity)
    
    // 3. Redis 预热（关键步骤）
    key := fmt.Sprintf("activity:%d:stock", id)
    enrolledKey := fmt.Sprintf("activity:%d:enrolled_set", id)
    
    pipe := s.redis.Pipeline()
    pipe.Set(ctx, key, activity.MaxCapacity, 7*24*time.Hour)
    pipe.Del(ctx, enrolledKey)
    pipe.Set(ctx, fmt.Sprintf("activity:%d:warmup", id), "true", 0)
    _, err = pipe.Exec(ctx)
    if err != nil {
        // 预热失败 → 回滚 DB 状态 → 返回错误
        activity.Status = "DRAFT"
        s.repo.Update(activity)
        return fmt.Errorf("redis warmup failed: %w", err)
    }
    
    return nil
}
```

### 预热失败的防御

- DB 状态回滚 → 活动保持 DRAFT，商户重新上架
- 告警：预热失败 = 严重运维事件，必须立即处理
- 预热完成后，Redis 是唯一的库存权威来源

---

## 5. 库存回补（冲正机制）

### 何时需要冲正

| 场景 | 原因 | 冲正动作 |
|---|---|---|
| Worker INSERT enrollments 冲突 | 极端情况下两条 Kafka 消息同时消费 | Redis `INCR stock` + `SREM enrolled_set` |
| 订单过期 | 用户 15 分钟内未支付 | Redis `INCR stock`（释放库存） |
| 商户取消活动 | CANCELLED 状态 | Redis `SET stock = max_capacity`（全量回补） |

### 冲正代码示例（Go Worker）

```go
// order_worker.go
func (w *OrderWorker) processMessage(msg *kafka.Message) {
    var req EnrollmentRequest
    json.Unmarshal(msg.Value, &req)
    
    err := w.tx(func(tx *gorm.DB) error {
        // 1. 更新报名状态  QUEUING → SUCCESS
        err := tx.Exec(
            "UPDATE enrollments SET status='SUCCESS', finalized_at=NOW() WHERE id=?",
            req.EnrollmentID,
        ).Error
        if err != nil {
            return fmt.Errorf("update enrollment: %w", err)
        }
        
        // 2. 创建订单
        order := &domain.Order{
            EnrollmentID: req.EnrollmentID,
            UserID:       req.UserID,
            ActivityID:   req.ActivityID,
            Amount:       req.Amount,
            Status:       "PENDING",
            ExpiredAt:    time.Now().Add(15 * time.Minute),
        }
        err = tx.Create(order).Error
        if err != nil {
            // 唯一键冲突 → 冲正
            w.compensateRedis(req.UserID, req.ActivityID)
            tx.Exec("UPDATE enrollments SET status='FAILED' WHERE id=?", req.EnrollmentID)
            w.notifyUser(req.UserID, "ENROLL_FAIL", "系统处理冲突，请重试")
            return nil // 不返回 err，避免 Kafka 重试
        }
        
        // 3. 递增活动报名人数
        tx.Exec("UPDATE activities SET enroll_count=enroll_count+1 WHERE id=?", req.ActivityID)
        
        return nil
    })
    
    if err != nil {
        // DB 不可用 → 消息回 Kafka（重试队列）
        w.requeue(msg)
    }
}

// compensateRedis 将用户报名状态回退
func (w *OrderWorker) compensateRedis(userID uint64, activityID uint64) {
    ctx := context.Background()
    pipe := w.redis.Pipeline()
    pipe.Incr(ctx, fmt.Sprintf("activity:%d:stock", activityID))
    pipe.SRem(ctx, fmt.Sprintf("activity:%d:enrolled_set", activityID), userID)
    pipe.Exec(ctx)
}
```

---

## 6. 过期订单处理

### 定时任务（每 5 分钟）

```go
// order_expired_worker.go
func (w *ExpiredOrderWorker) Run() {
    for {
        time.Sleep(5 * time.Minute)
        
        // 查询过期的未支付订单
        var orders []domain.Order
        w.db.Where("status = 'PENDING' AND expired_at < NOW()").Find(&orders)
        
        for _, order := range orders {
            w.tx(func(tx *gorm.DB) error {
                // 1. 订单标为关闭
                tx.Model(&order).Update("status", "CLOSED")
                
                // 2. 报名状态回退
                tx.Model(&domain.Enrollment{}).
                    Where("id = ?", order.EnrollmentID).
                    Update("status", "CANCELLED")
                
                // 3. Redis 释放库存
                w.redis.Incr(ctx, fmt.Sprintf("activity:%d:stock", order.ActivityID))
                
                // 4. 通知用户
                w.notifyUser(order.UserID, "ORDER_EXPIRE", 
                    "您的订单已过期，库存已释放")
                
                return nil
            })
        }
    }
}
```

---

## 7. 分层限流设计（6 层防线）

```
          ┌─ Level 0: CDN ─────────────────────────────────┐
          │  静态资源 (CSS/JS/封面图) 全部走 CDN               │
          │  抢票接口不经过 CDN                                │
          └─────────────────────────────────────────────────┘
                       │
          ┌─ Level 1: Nginx ───────────────────────────────┐
          │  limit_req zone=burst burst=50 nodelay;         │
          │  单 IP 每秒 50 次请求，突发 50 不限制               │
          │  单 IP 最大并发连接数 ≤ 100                        │
          └─────────────────────────────────────────────────┘
                       │
          ┌─ Level 2: Gin 中间件层 ─────────────────────────┐
          │  JWT 鉴权中间件 → 未登录 401                        │
          │  IP 级限流 (已有): golang.org/x/time/rate        │
          │    → 注册 5/min, 其他接口 100/min                   │
          └─────────────────────────────────────────────────┘
                       │
          ┌─ Level 3: 用户级限流 ───────────────────────────┐
          │  Redis: INCR rate:user:{uid}:{activity_id}        │
          │  EXPIRE 1hr                                       │
          │  超过 10 次/小时 → 429                            │
          └─────────────────────────────────────────────────┘
                       │
          ┌─ Level 4: 业务校验 ─────────────────────────────┐
          │  活动状态 (PUBLISHED)                               │
          │  抢票窗口 (open_at ≤ now ≤ close_at)               │
          │  Redis SISMEMBER 已报名集合 (去重)                    │
          └─────────────────────────────────────────────────┘
                       │
          ┌─ Level 5: Redis Lua 原子扣减 🔑 ────────────────┐
          │  库存扣减 + 用户标记在同一 Lua 内                     │
          │  返回值 -1(售罄) / -2(重复) / ≥1(排队)                │
          │  无锁、无阻塞、单线程串行                              │
          └─────────────────────────────────────────────────┘
                       │
          ┌─ Level 6: DB 层 (最终防线) ────────────────────┐
          │  UNIQUE (user_id, activity_id)                   │
          │  Worker INSERT 冲突 → 冲正回补                      │
          └─────────────────────────────────────────────────┘
```

> **核心设计哲学：** 每一层都是下一层的安全网。Lua 扣减是第一线的"防超卖"保证，DB 唯一键是兜底。

---

## 8. 开发阶段简化方案（Alpha）

Alpha 阶段 **没有 Redis 和 Kafka**，用以下方式模拟：

```go
// 内存替代 Redis（仅开发环境）
type MockStockManager struct {
    mu      sync.Mutex
    stock   map[uint64]int            // activity_id → 剩余库存
    enrolled map[uint64]map[uint64]bool // activity_id → {user_id}
}

func (m *MockStockManager) TryEnroll(activityID, userID uint64) (int64, error) {
    m.mu.Lock()
    defer m.mu.Unlock()
    
    if m.enrolled[activityID][userID] {
        return -2, errors.New("already enrolled")
    }
    if m.stock[activityID] <= 0 {
        return -1, errors.New("sold out")
    }
    
    m.stock[activityID]--
    m.enrolled[activityID][userID] = true
    return int64(m.stock[activityID]), nil
}
```

Kafka 用 Go **channel** 替代：
```go
// Worker 从 channel 消费
enrollCh := make(chan EnrollmentRequest, 10000)
go func() {
    for req := range enrollCh {
        // 同 Worker 处理逻辑
    }
}()
```

> 从 Alpha → Beta，只需替换两个依赖：`MockStockManager` → Redis Lua，`chan` → Kafka。业务逻辑不变。

---

## 9. 关键性能指标

| 指标 | 目标 | 测量方法 |
|---|---|---|
| 抢购接口 P99 RT | ≤ 200ms | JMeter + APM |
| Redis Lua 执行时间 | ≤ 1ms (Redis 单命令) | Redis SLOWLOG |
| 单节点 Go 处理 TPS | ≥ 2,000 | wrk / JMeter |
| Kafka 消费延迟 | ≤ 3s (99% 消息) | Kafka Consumer Lag 监控 |
| DB 落盘延迟 | ≤ 5s | 报名时间戳差值 |
| 零超卖率 | 100% | DB enroll_count ≤ max_capacity 校验 |

---

## 10. 异常处理决策树

```
抢购请求进入
    │
    ├── 无 JWT → 401 → 结束
    ├── IP 限流命中 → 429 → 结束
    ├── 用户限流命中 → 429 → 结束
    ├── 活动不存在 → 404 → 结束
    ├── 活动未上架 → 410 → 结束
    ├── 不在抢票窗口 → 410 → 结束
    ├── Lua 返回 -1 (库存不足) → 410 "已售罄" → 结束
    ├── Lua 返回 -2 (重复) → 409 "已报名" → 结束
    ├── Lua 返回 ≥1 (成功) →
    │   ├── DB INSERT failure →
    │   │   └── Redis 冲正 (INCR stock + SREM user)
    │   │   └── Kafka retry
    │   └── DB INSERT success →
    │       ├── Kafka 发送成功 → 202 Accepted
    │       └── Kafka 发送失败 → 本地缓存重试队列
    └── 内部错误 → 500 + 告警
```

---

## 11. Worker 部署与扩展

```
Order Worker 配置：
├── 并发消费者数：3 (可水平扩展)
├── 每批拉取条数：100
├── 批处理间隔：500ms (不满 100 条也提交)
├── Kafka Consumer Group: enrollment-workers
├── Offset 提交策略：Auto Commit (每 2s) + 手动 ack 每条处理完
└── 失败重试策略：
    ├── DB 不可达 → 消息回退 topic (DLQ)
    ├── 业务冲突 → 不重试 (冲正处理)
    └── Redis 不可达 → 直接报错告警
```
