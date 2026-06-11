# Sprint 3 完整闭环验收清单

> **用途：** Sprint 3 专用端到端验收文档，覆盖从商户建活动到用户完成报名、订单流转、通知触达、行为埋点的完整链路。  
> **使用方式：** 按章节顺序执行，每步勾选 `[ ]`，填写实际证据后方可视为通过。  
> **前置条件：** 见第零章。  
> **图例：** `[ ]` 待验证 · `[x]` 已通过 · `[!]` 有异常（在备注中说明）

---

## 第零章：环境前置检查

> 所有后续测试依赖此章全部通过。

### 0.1 基础服务（Docker）

| # | 检查项 | 验证命令 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 0.1.1 | `[ ]` MySQL 健康 | `docker-compose ps` | `mysql` 容器 `healthy` | 终端输出 |
| 0.1.2 | `[ ]` Redis 健康 | `docker-compose ps` | `redis` 容器 `healthy` | 终端输出 |
| 0.1.3 | `[ ]` Kafka 健康 | `docker-compose ps` | `kafka` 容器 `healthy` | 终端输出 |
| 0.1.4 | `[ ]` Prometheus 健康（可选但推荐） | `curl http://localhost:9090/-/healthy` | `200 OK` | 终端输出 |
| 0.1.5 | `[ ]` Grafana 健康（可选但推荐） | 访问 `http://localhost:3000` | 登录页加载 | 浏览器截图 |

### 0.2 后端服务

| # | 检查项 | 验证命令 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 0.2.1 | `[ ]` 后端编译无报错 | `cd backend && go build ./...` | 无错误输出，`exit 0` | 终端输出 |
| 0.2.2 | `[ ]` 后端服务启动 | `go run ./cmd/server` | 输出 `Server starting on :8080` | 终端日志 |
| 0.2.3 | `[ ]` 健康探针正常 | `curl http://localhost:8080/api/v1/health` | HTTP 200 | 终端/Postman |

### 0.3 Seed 数据

| # | 检查项 | 验证命令 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 0.3.1 | `[ ]` Seed 执行成功 | `cd backend && go run ./scripts/seed` | 无报错，"seed completed" | 终端输出 |
| 0.3.2 | `[ ]` 普通用户账号可用 | MySQL: `SELECT phone,role FROM users LIMIT 5` | 含 `CUSTOMER` 角色行（如 `13800000001`） | DB 查询截图 |
| 0.3.3 | `[ ]` 商户账号可用 | MySQL: `SELECT phone,role FROM users WHERE role='MERCHANT'` | 含 `MERCHANT` 账号（如 `13800000004`） | DB 查询截图 |
| 0.3.4 | `[ ]` 已发布活动存在 | MySQL: `SELECT id,status,max_capacity FROM activities WHERE status='PUBLISHED' LIMIT 3` | 至少 1 条 `PUBLISHED` 且 `max_capacity > 0` | DB 查询截图 |

### 0.4 前端服务

| # | 检查项 | 验证命令 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 0.4.1 | `[ ]` 前端依赖安装 | `cd frontend && pnpm install` | 无 peer/resolution 错误 | 终端输出 |
| 0.4.2 | `[ ]` 前端服务启动 | `pnpm dev` | `Local: http://localhost:5173` | 终端输出 |
| 0.4.3 | `[ ]` Mock 已关闭 | 检查 `.env` 或 `.env.local` | `VITE_USE_MOCK` 不为 `true`（联调态） | env 文件内容 |
| 0.4.4 | `[ ]` 首页可访问 | 浏览器访问 `http://localhost:5173` | 首页正常加载，无白屏 | 浏览器截图 |

---

## 第一章：商户登录

**对应 SRS：** 商户端鉴权与账号管理  
**接口：** `POST /api/v1/auth/login`

### 1.1 登录流程

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 1.1.1 | `[ ]` 访问商户登录页 | 浏览器访问 `/login`（或 `/merchant/login`）| 登录表单正常渲染，无 JS 报错 | 浏览器截图 |
| 1.1.2 | `[ ]` 商户凭证登录 | 输入 `phone=13800000004`，`password=test123456`，提交 | HTTP 200，返回 `{ code:0, data:{ token:... } }` | DevTools Network 截图 |
| 1.1.3 | `[ ]` Token 存储 | DevTools → Application → LocalStorage → `localhost:5173` | `token` 字段非空 | DevTools 截图 |
| 1.1.4 | `[ ]` 角色鉴权 | 查看 token payload（Base64 decode JWT） | `role=MERCHANT` | token 解析截图 |
| 1.1.5 | `[ ]` 跳转商户控制台 | 登录后自动跳转 | URL 变为 `/merchant/` 或 `/merchant/activities` | 浏览器地址栏截图 |
| 1.1.6 | `[ ]` 错误凭证拒绝 | 输入错误密码，提交 | HTTP 401，页面提示错误文案 | DevTools + 页面截图 |

**备注：**  
```
实际测试账号：_______________  实际 token（截取前 20 字符）：_______________
```

---

## 第二章：商户创建并发布活动

**对应 SRS：** 活动管理（商户端）  
**接口：** `POST /api/v1/activities`、`PUT /api/v1/activities/:id/publish`

### 2.1 创建活动

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 2.1.1 | `[ ]` 进入创建活动页 | 商户控制台 → 新建活动 | 表单页面正常加载 | 浏览器截图 |
| 2.1.2 | `[ ]` 提交有效活动 | 填写标题、类别、容量（建议 `max_capacity=50`）、报名时间、活动时间，提交 | `POST /api/v1/activities` 返回 HTTP 201，`data.id` 非空 | DevTools Network + 响应体截图 |
| 2.1.3 | `[ ]` 活动入库 | MySQL: `SELECT id,title,status FROM activities ORDER BY id DESC LIMIT 1` | 新活动状态为 `DRAFT` | DB 查询截图 |
| 2.1.4 | `[ ]` 表单校验（报名时间顺序） | 将报名结束时间填为早于开始时间 | 前端拦截，显示校验错误文案 | 页面截图 |

### 2.2 发布活动

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 2.2.1 | `[ ]` 发布操作触发 | 在活动列表或编辑页点击「发布」 | `PUT /api/v1/activities/:id/publish` 返回 HTTP 200 | DevTools Network 截图 |
| 2.2.2 | `[ ]` 状态变更为 PUBLISHED | MySQL: `SELECT status FROM activities WHERE id=:id` | `status='PUBLISHED'` | DB 查询截图 |
| 2.2.3 | `[ ]` Redis 库存预热 | `docker exec -it <redis-container> redis-cli GET activity:<id>:stock` | 返回 `"50"`（与 `max_capacity` 一致） | 终端输出截图 |
| 2.2.4 | `[ ]` 前端列表状态刷新 | 发布后商户活动列表 | 对应活动标签/状态更新为「已发布」 | 浏览器截图 |

**本章产出的活动 ID（供后续章节使用）：**
```
活动 ID：_______________  标题：_______________  max_capacity：_______________
```

---

## 第三章：C 端登录

**对应 SRS：** 用户端鉴权  
**接口：** `POST /api/v1/auth/login`

### 3.1 登录流程

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 3.1.1 | `[ ]` 访问登录页 | 浏览器访问 `/login` | 登录表单正常渲染 | 浏览器截图 |
| 3.1.2 | `[ ]` 普通用户登录 | 输入 `phone=13800000001`，`password=test123456` | HTTP 200，返回有效 token | DevTools Network 截图 |
| 3.1.3 | `[ ]` Token 存储与角色 | LocalStorage `token` + JWT payload | `role=CUSTOMER`，token 非空 | DevTools + 解析截图 |
| 3.1.4 | `[ ]` 未登录时访问受保护页面 | 清空 token 后访问 `/app/orders` | 自动跳转 `/login`，带 `state.from` | 浏览器 URL 截图 |
| 3.1.5 | `[ ]` 登出后清理 | 点击登出按钮 | LocalStorage `token` 已清除，跳回 `/login` | DevTools 截图 |

**备注：**
```
实际测试账号：_______________
```

---

## 第四章：用户浏览首页 / 活动广场 / 活动详情

**对应 SRS：** C 端浏览与发现  
**接口：** `GET /api/v1/recommendations/hot`、`GET /api/v1/activities`、`GET /api/v1/activities/:id`、`GET /api/v1/activities/:id/stock`

### 4.1 首页（`/`）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 4.1.1 | `[ ]` 推荐区接口请求 | DevTools Network | `GET /api/v1/recommendations/hot` 返回 200，有 `data` 数组 | DevTools 截图 |
| 4.1.2 | `[ ]` 推荐内容渲染 | 页面视图 | 至少 1 张活动卡片从接口数据渲染（非 Mock） | 浏览器截图 |
| 4.1.3 | `[ ]` 无 MSW 拦截 | DevTools Network → 查看请求 URL | 所有接口请求指向 `localhost:8080`，无 `[MSW]` 标记 | DevTools 截图 |

### 4.2 活动广场（`/activities`）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 4.2.1 | `[ ]` 活动列表接口请求 | DevTools Network | `GET /api/v1/activities` 返回 200，含 `list` 数组 | DevTools 截图 |
| 4.2.2 | `[ ]` 列表正常渲染 | 页面视图 | 多个活动卡片展示，含标题、容量信息 | 浏览器截图 |
| 4.2.3 | `[ ]` 搜索功能 | 在搜索框输入关键词，回车 | 列表筛选，URL 含 `keyword=...` 参数 | 浏览器地址栏 + 页面截图 |
| 4.2.4 | `[ ]` 分页功能 | 翻到第 2 页 | `page=2` 参数生效，列表更新 | DevTools 截图 |
| 4.2.5 | `[ ]` 移动端布局（`<768px`） | DevTools 模拟 375px 宽度 | 卡片无溢出、无横向滚动条、按钮可点击 | DevTools 设备模拟截图 |

### 4.3 活动详情（`/activity/:id`）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 4.3.1 | `[ ]` 详情接口请求 | DevTools Network | `GET /api/v1/activities/:id` + `GET /api/v1/activities/:id/stock` 均 200 | DevTools 截图 |
| 4.3.2 | `[ ]` 库存显示正确 | 页面库存/余量数字 | 与 Redis `activity:<id>:stock` 一致（允许小延迟） | 页面截图 + Redis 截图 |
| 4.3.3 | `[ ]` 报名按钮可见 | 已登录用户 | 显示「立即报名」或「加入排队」等可操作按钮 | 浏览器截图 |
| 4.3.4 | `[ ]` 未登录跳转 | 登出后访问详情页，点击报名按钮 | 跳转 `/login`（携带 `state.from`） | 浏览器 URL 截图 |
| 4.3.5 | `[ ]` 移动端布局（`<768px`） | DevTools 模拟 375px | 标题、图片、库存信息、报名按钮无截断或遮挡 | DevTools 截图 |

---

## 第五章：用户发起报名进入 QUEUING

**对应 SRS：** 报名抢票（异步排队）  
**接口：** `POST /api/v1/enrollments`  
**预期 HTTP：** 202 + `code=1201`

### 5.1 首次报名

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 5.1.1 | `[ ]` 点击报名按钮（已登录） | 活动详情页点击报名 | `POST /api/v1/enrollments` 请求发出，`Authorization: Bearer <token>` 头存在 | DevTools Network 截图 |
| 5.1.2 | `[ ]` 响应码为 202 + 1201 | 查看响应体 | `{ "code": 1201, "message": "...", "data": { "enrollment_id": ... } }` | DevTools 响应体截图 |
| 5.1.3 | `[ ]` 前端 UI 反馈 | 页面提示 | 显示「排队中」或「正在处理」等状态提示 | 浏览器截图 |
| 5.1.4 | `[ ]` 报名记录入库（QUEUING） | MySQL: `SELECT id,status,activity_id,user_id FROM enrollments ORDER BY id DESC LIMIT 1` | `status='QUEUING'` | DB 查询截图 |
| 5.1.5 | `[ ]` Kafka 消息已投递 | 后端日志 | 含 `enrollment queued` 或 `kafka produce` 相关日志行 | 后端终端日志截图 |

### 5.2 边界场景验证

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 5.2.1 | `[ ]` 重复报名拒绝 | 同一用户对同一活动再次点击报名 | HTTP 409 + `code=1005`，前端显示提示文案 | DevTools + 页面截图 |
| 5.2.2 | `[ ]` 售罄场景（库存为 0） | 使用已满员活动或耗尽库存后再试 | HTTP 200/410 + `code=1101`，前端显示「已售罄」 | DevTools + 页面截图 |

---

## 第六章：Worker 落盘为 SUCCESS 并生成 PENDING 订单

**对应 SRS：** 异步报名处理、订单生成  
**涉及模块：** `worker/enrollment_worker.go`、`service/enrollment_service.go`、`service/order_service.go`

### 6.1 Worker 处理验证

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 6.1.1 | `[ ]` Worker 消费消息 | 后端日志（等待 5-15 秒） | 出现 `worker: processing enrollment` 或类似日志 | 后端终端日志截图 |
| 6.1.2 | `[ ]` 报名状态变更为 SUCCESS | MySQL: `SELECT status FROM enrollments WHERE id=:id` | `status='SUCCESS'` | DB 查询截图 |
| 6.1.3 | `[ ]` 订单自动生成 | MySQL: `SELECT id,status,enrollment_id FROM orders WHERE enrollment_id=:id` | 出现 `status='PENDING'` 的订单行 | DB 查询截图 |
| 6.1.4 | `[ ]` Redis 库存扣减 | `redis-cli GET activity:<id>:stock` | 较报名前减少（扣减成功） | Redis 截图（报名前后对比） |
| 6.1.5 | `[ ]` Worker 指标上报 | `curl http://localhost:8080/metrics \| grep worker_messages_processed` | `worker_messages_processed_total{status="success"}` 计数 ≥ 1 | 终端输出截图 |

### 6.2 前端报名状态轮询

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 6.2.1 | `[ ]` 前端轮询 enrollment 状态 | DevTools Network（等待 Worker 完成） | `GET /api/v1/enrollments/:id/status` 出现并返回 `SUCCESS` | DevTools 截图 |
| 6.2.2 | `[ ]` UI 状态更新 | 活动详情页或报名状态页 | 状态从「排队中」更新为「报名成功」 | 浏览器截图 |

---

## 第七章：用户完成支付，或订单超时关闭

**对应 SRS：** 订单支付、订单过期  
**接口：** `POST /api/v1/orders/:id/pay`  
**后台任务：** `ScanExpired()` 定时扫描

### 7.1 用户完成支付（Happy Path）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 7.1.1 | `[ ]` 前端订单页可见 PENDING 订单 | 访问 `/app/orders` | 出现刚生成的 PENDING 订单 | 浏览器截图 |
| 7.1.2 | `[ ]` 触发支付 | 点击「立即支付」或调用 `POST /api/v1/orders/:id/pay` | HTTP 200，订单状态更新响应 | DevTools + DB 截图 |
| 7.1.3 | `[ ]` 订单状态变更为 PAID | MySQL: `SELECT status FROM orders WHERE id=:id` | `status='PAID'` | DB 查询截图 |
| 7.1.4 | `[ ]` 订单详情页更新 | 访问 `/app/orders/:id` | 显示「已支付」状态 | 浏览器截图 |

### 7.2 订单超时关闭（Timeout Path）

> **操作提示：** 可临时将订单 `expired_at` 设为过去时间触发扫描，或等待自然过期（依配置）。

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 7.2.1 | `[ ]` 制造过期订单 | MySQL: `UPDATE orders SET expired_at=NOW()-INTERVAL 1 SECOND WHERE id=:id AND status='PENDING'` | 更新成功 | DB 截图 |
| 7.2.2 | `[ ]` ScanExpired 触发 | 后端日志 | 出现 `scan expired orders` 或 `order closed` 相关日志 | 后端日志截图 |
| 7.2.3 | `[ ]` 订单状态变为 CLOSED | MySQL: `SELECT status FROM orders WHERE id=:id` | `status='CLOSED'` | DB 查询截图 |
| 7.2.4 | `[ ]` 库存回补执行 | Redis: `GET activity:<id>:stock` + MySQL 库存 | Redis 库存 +1（回补），与 DB 逻辑一致 | Redis + DB 截图（关闭前后对比） |
| 7.2.5 | `[ ]` 无负库存 | Redis 最终值 | `activity:<id>:stock` **≥ 0** | Redis 截图 |
| 7.2.6 | `[ ]` 无重复回补 | MySQL: `SELECT count(*) FROM orders WHERE enrollment_id=:id AND status='CLOSED'` | 仅 1 条 CLOSED 记录，无重复触发 | DB 截图 |

---

## 第八章：通知页与通知铃铛出现对应业务通知

**对应 SRS：** 通知系统  
**接口：** `GET /api/v1/notifications`、`GET /api/v1/notifications/unread-count`

### 8.1 报名成功通知（ENROLL_SUCCESS）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 8.1.1 | `[ ]` ENROLL_SUCCESS 通知入库 | MySQL: `SELECT type,is_read,related_id FROM notifications WHERE user_id=:uid ORDER BY id DESC LIMIT 3` | 含 `type='ENROLL_SUCCESS'` 行，`related_id` 与 enrollment/order id 一致 | DB 查询截图 |
| 8.1.2 | `[ ]` 通知铃铛未读数 ≥ 1 | DevTools：`GET /api/v1/notifications/unread-count` | `data.unread_count ≥ 1` | DevTools 截图 |
| 8.1.3 | `[ ]` 铃铛角标显示 | 页面顶部 NotificationBell | 显示红点或数字角标 | 浏览器截图 |
| 8.1.4 | `[ ]` 通知页列表可见 | 访问 `/app/notifications` | 列表中含「报名成功」或对应文案的通知条目 | 浏览器截图 |
| 8.1.5 | `[ ]` 标记已读 | 点击通知条目 | `PUT /api/v1/notifications/:id/read` 返回 200，未读数减少 | DevTools + 铃铛截图 |

### 8.2 订单过期通知（ORDER_EXPIRE）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 8.2.1 | `[ ]` ORDER_EXPIRE 通知入库 | MySQL: `SELECT type,related_id FROM notifications WHERE user_id=:uid AND type='ORDER_EXPIRE'` | 含对应订单 id 的 `ORDER_EXPIRE` 行 | DB 查询截图 |
| 8.2.2 | `[ ]` 通知文案无空标题 | 查看通知记录 `content` 字段 | 活动标题不为空、不含 `unknown` 占位符 | DB 查询截图 |
| 8.2.3 | `[ ]` 通知页面显示 | 访问 `/app/notifications` 并刷新 | 订单过期通知出现在列表中 | 浏览器截图 |

### 8.3 通知体验一致性

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 8.3.1 | `[ ]` 空通知列表 | 使用无通知的账号访问通知页 | 显示空态占位（而非白屏或 JS 报错） | 浏览器截图 |
| 8.3.2 | `[ ]` 通知铃铛全量同步 | 切换路由后铃铛未读数 | 路由切换或 `window focus` 后未读数与接口一致（不出现脏数据） | 浏览器截图 |

---

## 第九章：行为埋点写入成功

**对应 SRS：** 行为数据采集、推荐热度  
**接口：** `POST /api/v1/behaviors`（或 `/behaviors/batch`）

### 9.1 埋点上报验证

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 9.1.1 | `[ ]` 活动详情页触发 VIEW 埋点 | DevTools Network，访问 `/activity/:id` | `POST /api/v1/behaviors` 请求出现，`body.event_type='VIEW'`，`body.target_id` 为活动 id | DevTools Network + 请求体截图 |
| 9.1.2 | `[ ]` VIEW 埋点返回 200 | 查看响应状态 | HTTP 200，`code=0` | DevTools 截图 |
| 9.1.3 | `[ ]` 推荐/精选点击触发 CLICK 埋点 | 首页或广场点击活动卡片 | `POST /api/v1/behaviors`，`event_type='CLICK'` | DevTools 截图 |
| 9.1.4 | `[ ]` 搜索触发 SEARCH 埋点 | 活动广场搜索框提交 | `POST /api/v1/behaviors`，`event_type='SEARCH'` | DevTools 截图 |
| 9.1.5 | `[ ]` 行为数据入库 | MySQL: `SELECT event_type,target_id,user_id FROM user_behaviors ORDER BY id DESC LIMIT 5` | 含 `VIEW`/`CLICK`/`SEARCH` 行，user_id 与登录用户一致 | DB 查询截图 |
| 9.1.6 | `[ ]` 埋点不阻塞主交互 | 手工观察：关闭网络后或埋点请求报错后 | 页面核心功能（报名/浏览）不受影响 | 操作记录 |

### 9.2 埋点生效于推荐/热度（端到端证据）

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 9.2.1 | `[ ]` 埋点写入后热度或推荐顺序变化可观测 | 触发多次 VIEW/CLICK 后，调用 `GET /api/v1/recommendations/hot` 或热度相关接口 | 该活动热度分在推荐结果中可见变化，**或** 后端日志显示热度更新触发 | 接口响应截图 / 后端日志截图 |

> **注：** 若热度为定时批量重算，需在重算周期后查询。本项为 Sprint 3 强制要求，不接受"只上报、不验证结果"的交付。

---

## 第十章：整体闭环回归

### 10.1 端到端链路摘要确认

执行完第一章到第九章后，逐项确认全链路数据一致性：

| # | 链路节点 | 最终状态 | 对应数据库/Redis 证据 |
|---|----------|----------|----------------------|
| 10.1.1 | `[ ]` 商户已登录并创建活动 | `activities.status = 'PUBLISHED'` | DB 截图 |
| 10.1.2 | `[ ]` Redis 库存已预热 | `activity:<id>:stock = max_capacity` | Redis 截图 |
| 10.1.3 | `[ ]` C 端用户已登录 | LocalStorage token 有效 | DevTools 截图 |
| 10.1.4 | `[ ]` 报名记录已创建 | `enrollments.status = 'SUCCESS'` | DB 截图 |
| 10.1.5 | `[ ]` 订单已生成 | `orders.status = 'PENDING'` 或 `'PAID'`/`'CLOSED'` | DB 截图 |
| 10.1.6 | `[ ]` 通知已写入 | `notifications` 含 `ENROLL_SUCCESS` 且不为空 | DB 截图 |
| 10.1.7 | `[ ]` ORDER_EXPIRE 通知已写入（过期路径） | `notifications` 含 `ORDER_EXPIRE` | DB 截图 |
| 10.1.8 | `[ ]` 行为数据已入库 | `user_behaviors` 含 VIEW/CLICK | DB 截图 |
| 10.1.9 | `[ ]` 库存无负值 | Redis + DB 不出现负库存 | Redis + DB 截图 |
| 10.1.10 | `[ ]` 无重复成功报名 | 同用户同活动无多条 `SUCCESS` | DB 截图 |

### 10.2 可观测性确认

| # | 检查项 | 验证方式 | 预期结果 | 证据位置 |
|---|--------|----------|----------|----------|
| 10.2.1 | `[ ]` HTTP 指标正常 | `curl http://localhost:8080/metrics \| grep http_requests_total` | 计数 > 0，含各路由 | 终端输出截图 |
| 10.2.2 | `[ ]` Worker 指标正常 | `curl http://localhost:8080/metrics \| grep worker_` | `worker_messages_processed_total{status="success"}` 有记录 | 终端输出截图 |
| 10.2.3 | `[ ]` Kafka Lag 指标 | `curl http://localhost:8080/metrics \| grep worker_kafka_lag` | `worker_kafka_lag_approx` 存在，消费后 lag 趋近 0 | 终端输出截图 |
| 10.2.4 | `[ ]` Grafana Dashboard 可查看（如已部署） | `http://localhost:3000` → Import dashboard | HTTP 时延、Worker 成功/失败面板有数据 | Grafana 截图 |

---

## 附录 A：快速测试账号参考

| 角色 | 手机号 | 密码 | 用途 |
|------|--------|------|------|
| CUSTOMER | `13800000001` | `test123456` | C 端报名/浏览 |
| CUSTOMER | `13800000002` | `test123456` | 并发测试备用 |
| MERCHANT | `13800000004` | `test123456` | 商户活动管理 |

> 以上账号由 `backend/scripts/seed/main.go` 导入，如 Seed 数据有变动请以实际 DB 数据为准。

---

## 附录 B：关键 MySQL 查询速查

```sql
-- 查看最新报名状态
SELECT id, user_id, activity_id, status, created_at
FROM enrollments ORDER BY id DESC LIMIT 5;

-- 查看最新订单
SELECT id, enrollment_id, status, expired_at, created_at
FROM orders ORDER BY id DESC LIMIT 5;

-- 查看最新通知
SELECT id, user_id, type, related_id, is_read, created_at
FROM notifications ORDER BY id DESC LIMIT 10;

-- 查看最新行为埋点
SELECT id, user_id, event_type, target_id, created_at
FROM user_behaviors ORDER BY id DESC LIMIT 10;

-- 库存一致性检查（成功报名数 <= max_capacity）
SELECT a.id, a.title, a.max_capacity,
       COUNT(e.id) AS success_count
FROM activities a
LEFT JOIN enrollments e ON a.id = e.activity_id AND e.status = 'SUCCESS'
GROUP BY a.id HAVING success_count > 0;
```

---

## 附录 C：Redis 快捷命令

```bash
# 连接 Redis（Docker）
docker exec -it $(docker-compose ps -q redis) redis-cli

# 查看活动库存
GET activity:<id>:stock

# 查看所有活动库存 key
KEYS activity:*:stock
```

---

## 附录 D：验收签字与汇总

| 章节 | 负责人 | 通过项 / 总项 | 备注 |
|------|--------|--------------|------|
| 第零章：环境前置 | | / 16 | |
| 第一章：商户登录 | | / 6 | |
| 第二章：创建并发布活动 | | / 8 | |
| 第三章：C 端登录 | | / 5 | |
| 第四章：浏览首页/广场/详情 | | / 13 | |
| 第五章：报名进入 QUEUING | | / 7 | |
| 第六章：Worker 落盘 + PENDING 订单 | | / 7 | |
| 第七章：支付或订单过期关闭 | | / 10 | |
| 第八章：通知页与铃铛 | | / 10 | |
| 第九章：行为埋点写入 | | / 7 | |
| 第十章：闭环回归 + 可观测性 | | / 14 | |
| **合计** | | **/103** | |

**验收日期：** _______________  
**验收结论：** `[ ]` 通过  `[ ]` 有阻塞项（见下）

**阻塞项说明：**
```
（如有，请在此列明阻塞章节、现象描述与负责人）
```
