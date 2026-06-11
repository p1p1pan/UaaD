# 压测基线

## 背景

### 零超卖回归

系统已有零超卖的回归测试

```bash
# 零超卖验证：500 并发抢 10 张票 → 恰好 10 人成功
cd backend && go test -v -tags=stress -run TestConcurrentEnrollment_Stock10 -count=1 ./tests/

# 吞吐量基准
cd backend && go test -v -tags=stress -bench=BenchmarkEnrollmentThroughput -benchtime=10s -count=1 ./tests/
```

**判断标准**：

```
success=10, stock=10 → 零超卖 PASS
success>10           → 超卖 BUG
```

### 架构

抢票链路已改为 **Redis Lua 原子扣减** → **Kafka 缓冲** → **Worker 异步落库 MySQL**：

1. MySQL 默认隔离级别为可重复读（RR）；高并发场景可考虑读已提交（RC），不可重复读在业务层通常可接受。
2. Redis 单线程执行；Lua 脚本将「幂等检查 + 扣库存 + 入已报名集合 + 全局排队号」视为一条原子命令。
3. Kafka 用于削峰，保护 MySQL；Worker 消费后事务写入报名与订单。

---

## 压测主口径

- **被压接口**：`POST /api/v1/enrollments`
- **热点场景**：针对 **单个** 已发布且 **Redis 库存已预热** 的活动（CSV 中同一 `activity_id`）

### 成功


| 条件                                 | 含义                  |
| ---------------------------------- | ------------------- |
| **HTTP 202** 且响应体 `code = 1201`    | 成功进入排队（异步落库）。       |
| **HTTP 200 或 410** 且 `code = 1101` | 业务性售罄拒绝（库存不足等业务结果）。 |


### 失败

- **任意 5xx**、请求 **超时**、连接失败。
- **非预期组合**：例如 202 但非 1201、200/410 但非 1101、非 409 的 4xx（若出现）等（JMeter 脚本中 `outcome=FAILURE` 便于人工对照 JTL/HTML）。

### `enrollment-load.jmx`


| `outcome`  | 说明                                  |
| ---------- | ----------------------------------- |
| `QUEUED`   | `202` + `code=1201`                 |
| `SOLD_OUT` | `200` 或 `410` + `code=1101`         |
| `CONFLICT` | `409`（重复报名等，与 Sprint 3 主口径并存档时单独统计） |
| `FAILURE`  | 5xx 或其它非预期                          |


HTTP 断言允许 `200|202|409|410`，`assume_success=false`：出现 **5xx** 时样本记为 **失败**。

---

## 执行步骤

以 3000 线程并发为例，直接执行`./run-jmeter-report.sh 3000`（最后的参数是线程数，不指定默认为1000）

注意，线程数实际会受到硬件条件和操作系统的限制，不一定能够到达设定值：

- 创建线程需要分配内存，需要确保JVM虚拟机有足够的可用内存
- 单个用户在系统中能够运行的总进程（含线程）数是有限的，可以使用`ulimit -u`查看

---

## 压测报告

Sprint 3 大规模压力测试已于 2026-05-02 完成，完整报告见 **[ST_REPORT.md](./ST_REPORT.md)**。