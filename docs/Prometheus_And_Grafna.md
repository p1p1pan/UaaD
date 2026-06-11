# Prometheus和Grafana

## 简介

**Prometheus（普罗米修斯**）是一个开源的系统监控和告警工具包，最初由SoundCloud开发，现已成为云原生基金会（CNCF）的顶级项目（和Kubernetes同级别），它会主动到监控目标那里通过HTTP拉取指标数据，然后将采集到的数据以时间序列的形式存储在本地磁盘上。Prometheus 支持PromQL查询语言，通过它可以对存储的数据进行复杂的查询、聚合和计算，例如过去1h内，CPU使用率超80%的服务器有哪些。

Grafana是一个完全开源的数据分析和可视化平台，它本身不存储任何数据，而是从各种数据源（如Prometheus）读取数据，然后用漂亮的图表展示出来。Grafana可以连接几十种数据源，包括InfluxDB、ElaticSearch、MySQL、PostgreSQL等等。可以在Grafana上创建包含多个图表的自定义仪表盘，比如一个“应用监控大屏幕”上同时展示QPS、P99延迟、错误率等信息。

在本项目中这两个中间件均使用Docker部署，因而Grafana和Prometheus之间应该使用Docker服务名通信，而不是localhost

## 后端埋点

后端在 `[backend/internal/middleware/metrics.go](../backend/internal/middleware/metrics.go)` 中通过 `prometheus/client_golang` 注册指标，并在 `init()` 里 `MustRegister`。HTTP 指标由 Gin 中间件写入；异步报名 Worker 在消费 Kafka 消息后写入 Worker 相关指标。

访问应用暴露的 `/metrics`（例如 `http://localhost:8080/metrics`）可看到 Prometheus 文本格式；Prometheus 按 `scrape_interval`（常见为 15s）从该端点拉取。

### HTTP 指标


| 指标名                             | 类型        | 标签                         | 说明                                        |
| ------------------------------- | --------- | -------------------------- | ----------------------------------------- |
| `http_requests_total`           | Counter   | `method`, `path`, `status` | 各接口请求次数                                   |
| `http_request_duration_seconds` | Histogram | `method`, `path`           | 各接口耗时（查询时用 `_bucket` / `_sum` / `_count`） |


### Worker / Kafka 异步链路指标


| 指标名                                          | 类型        | 标签                              | 说明                                                            |
| -------------------------------------------- | --------- | ------------------------------- | ------------------------------------------------------------- |
| `worker_messages_processed_total`            | Counter   | `status`（`success` / `failure`） | Worker 成功落盘与失败（含事务失败等路径）次数                                    |
| `worker_message_processing_duration_seconds` | Histogram | `status`                        | 单条消息处理耗时                                                      |
| `worker_kafka_lag_approx`                    | Gauge     | `topic`                         | 基于 `kafka-go` `Reader.Stats().Lag` 的滞后近似；无 topic 时为 `unknown` |


### PromQL 示例

在 Prometheus UI（Graph）或 Grafana 的查询框中使用下列表达式（Histogram 需用 `_bucket` 等后缀）。

**HTTP**

```promql
# 按 path 的每秒请求数（5 分钟窗口速率）
sum by (path) (rate(http_requests_total[5m]))
```

```promql
# 报名接口 P99 延迟（注意 path 以实际 Gin FullPath 为准，常见含路由前缀）
histogram_quantile(0.99, sum by (le, path) (rate(http_request_duration_seconds_bucket{path="/api/v1/enrollments"}[5m])))
```

```promql
# 全站 HTTP P95 延迟（按 path 聚合）
histogram_quantile(0.95, sum by (le, path) (rate(http_request_duration_seconds_bucket[5m])))
```

**Worker**

```promql
# Worker 成功 / 失败吞吐（条/秒）
sum by (status) (rate(worker_messages_processed_total[5m]))
```

```promql
# Worker 处理耗时 P95（按 status）
histogram_quantile(0.95, sum by (le, status) (rate(worker_message_processing_duration_seconds_bucket[5m])))
```

```promql
# 各 topic 消费滞后（Gauge，当前值）
max by (topic) (worker_kafka_lag_approx)
```

**快速浏览 UAAD 自定义指标名**

```promql
{__name__=~"http_.*|worker_.*"}
```

## 可视化仪表盘

### 连接数据源

访问 `http://localhost:3000`，使用 `admin` / `admin` 登录（首次登录若要求改密则按提示修改）。进入 **Connections → Data sources → Add new data source → Prometheus**，URL 填 `**http://prometheus:9090`**（Docker 网络内用服务名，不要用 `localhost`）。**Save & test** 通过后，新建 **Dashboard → Add visualization** 即可用 PromQL 画图。

### Sprint 3：可复用 Dashboard 面板建议

下面是一套**与当前 UAAD 指标一一对应**、适合**报名 / 抢票压测**时观察「HTTP 波动 + 异步 Worker」的默认布局。复制到新 Dashboard 后按实际 `path` 标签微调即可（在 Prometheus **Graph** 或 Grafana **Explore** 里执行 `{__name__=~"http_requests_total"}`，查看真实 `path` 字符串）。

**布局原则：** 第一行看吞吐与错误；第二行看 HTTP 时延；第三行看 Worker 与队列滞后。压测进行中可把各面板的 `rate(...[5m])` 改为 `**[1m]`**，曲线对短时尖峰更敏感（噪声也会略大）。

#### Row 1 — HTTP 吞吐与服务波动


| 建议标题       | 图表类型                 | PromQL（示例）                                                               | 说明                                                                                                            |
| ---------- | -------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| 全站 HTTP 吞吐 | Time series          | `sum(rate(http_requests_total[$__rate_interval]))`                       | Grafana 选 **Metrics** 时可改用 `$__rate_interval`；手写则用 `sum(rate(http_requests_total[1m]))`。观察压测 ramp 与结束是否断崖式变化。 |
| 报名相关接口吞吐   | Time series          | `sum by (path) (rate(http_requests_total{path=~".*enrollments.*"}[1m]))` | 覆盖 `POST /api/v1/enrollments` 等；若 `path` 不含 enrollments 字样，改为在 Explore 里查到的确切 `path` 或去掉 matcher。             |
| 服务端错误（5xx） | Time series          | `sum(rate(http_requests_total{status=~"5.."}[1m]))`                      | 压测期间应接近 0；尖峰说明后端或依赖抖动。                                                                                        |
| HTTP 状态码分布 | Time series（Stacked） | `sum by (status) (rate(http_requests_total[1m]))`                        | 对比 `202` / `200` / `4xx` 比例，与压测成功口径（如 202+1201）对照。                                                            |


#### Row 2 — HTTP 时延


| 建议标题                 | 图表类型               | PromQL（示例）                                                                                     | 说明                                        |
| -------------------- | ------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 报名接口 P50 / P95 / P99 | Time series（3 条查询） | 见下方 **报名延迟三联**                                                                                 | 同一路径三条 `histogram_quantile`，观察压测下尾延迟是否恶化。 |
| 全站按 path 的 P95       | Time series        | `histogram_quantile(0.95, sum by (le, path) (rate(http_request_duration_seconds_bucket[5m])))` | 快速发现最慢的若干接口。                              |


**报名延迟三联（将 `path` 换成你环境中的真实值）：**

```promql
histogram_quantile(0.50, sum by (le) (rate(http_request_duration_seconds_bucket{path="/api/v1/enrollments"}[5m])))
```

```promql
histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{path="/api/v1/enrollments"}[5m])))
```

```promql
histogram_quantile(0.99, sum by (le) (rate(http_request_duration_seconds_bucket{path="/api/v1/enrollments"}[5m])))
```

在 Grafana 中为三条查询设置 **Legend**：`P50`、`P95`、`P99`。

#### Row 3 — Worker 成功 / 失败与队列


| 建议标题            | 图表类型                    | PromQL（示例）                                                                                                    | 说明                                                                               |
| --------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Worker 处理吞吐     | Time series（Stacked 可选） | `sum by (status) (rate(worker_messages_processed_total[1m]))`                                                 | `success` / `failure` 两条线；压测时 success 应与进入队列的落盘大致同趋势；failure 持续升高需查 DB/唯一键/库存回补。 |
| Worker 处理耗时 P95 | Time series             | `histogram_quantile(0.95, sum by (le, status) (rate(worker_message_processing_duration_seconds_bucket[5m])))` | 异步链路是否变慢。                                                                        |
| Kafka 消费滞后（近似）  | Time series             | `max by (topic) (worker_kafka_lag_approx)`                                                                    | 队列积压近似；与 HTTP 202 洪峰对照，判断 Worker 是否跟得上。                                          |


#### 压测窗口内如何读图（验收对齐）

- **HTTP 吞吐**：与 JMeter 线程 ramp 同步上升，结束后下降；若 HTTP 很高而 Worker success 很低，检查 Kafka / Worker 是否单实例瓶颈。
- **5xx 与 P99**：压测全程 5xx 接近 0、P99 无失控单尖峰，可作为「服务波动可接受」的直观证据（仍需结合压测报告中的 P95/P99 数字）。
- **Worker success vs failure**：与业务上「成功排队落库 vs 事务失败冲正」一致；failure 与 MySQL 错误日志交叉验证。

### Dashboard 复用与导出

1. 在 Grafana 中完成上述面板后：**Dashboard settings（齿轮）→ JSON Model** 可复制整盘 JSON，或 **Share → Export** 下载文件。
2. 另一环境：**Dashboards → New → Import**，上传 JSON 或粘贴 ID/内容；导入后检查 **Data source** 仍指向同一 Prometheus（或变量化数据源）。
3. 建议为 Dashboard 命名并加标签，例如：`UAAD / Sprint3 / Enrollment & Worker`，便于与「仅 HTTP」大盘区分。

### 能力边界说明

- 当前自定义指标**不包含** JVM/Go 运行时默认导出项以外的业务字段；若 `/metrics` 上还挂载了 Go 默认采集器，可在 Explore 中额外增加 `process_cpu_seconds_total`、`go_goroutines` 等面板观察压测时进程资源，但本仓库文档以上表 **UAAD 自注册指标** 为主。

