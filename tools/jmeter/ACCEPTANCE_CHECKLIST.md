# Sprint 2 第二组（前后端联调）统一验收检查清单

> **执行人：** 同学甲  
> **执行时机：** 乙、丙、丁功能合稳后，末期统一验收  
> **目标：** 按 Sprint 2 DoD 核对联调质量，确保前后端闭环可演示、可压测

---

## 一、环境与启动检查

- [ ] **后端服务正常启动**
  - `cd backend && go run ./cmd/server` 无报错
  - 控制台输出 `Server running on :8080` 或类似日志
  - 数据库连接成功（MySQL 或 SQLite）

- [ ] **前端服务正常启动**
  - `cd frontend && pnpm dev` 无报错
  - 浏览器访问 `http://localhost:5173` 可打开首页
  - Chrome DevTools → Application → Service Workers：**无 MSW 注册**（`VITE_USE_MOCK=false` 生效）

- [ ] **Seed 数据已导入**
  - `cd backend && go run ./scripts/seed` 执行成功
  - 数据库中存在至少 5 个用户、20 个活动
  - 至少有 1 个 `Status=PUBLISHED` 且 `MaxCapacity > 0` 的活动可用于压测

---

## 二、Chrome DevTools Network 检查

### 2.1 核心页面请求检查

访问以下页面，打开 Chrome DevTools → Network，确认：

| 页面路由 | 预期请求 | 检查项 |
|---------|---------|--------|
| `/` (首页) | `GET /api/v1/recommendations` | ✅ 200 OK，返回推荐列表 |
| `/activities` (广场) | `GET /api/v1/activities` | ✅ 200 OK，返回活动列表（支持分页、筛选） |
| `/activities/:id` (详情) | `GET /api/v1/activities/:id` | ✅ 200 OK，返回活动详情 |
| `/login` → 登录 | `POST /api/v1/auth/login` | ✅ 200 OK，返回 token |
| `/app/*` (登录后) | 所有需鉴权请求 | ✅ Header 携带 `Authorization: Bearer <token>` |

- [ ] **无 MSW 拦截痕迹**：Network 中请求直接显示为 `localhost:8080`，无 `[MSW]` 标记
- [ ] **无异常 4xx/5xx**：除预期业务错误（如库存不足 200+1101、重复报名 409）外，无其他错误

### 2.2 鉴权与 401 处理

- [ ] **未登录访问受保护页面**：自动重定向到 `/login`
- [ ] **Token 过期或无效**：后端返回 401，前端自动清空 token 并跳转 `/login`
- [ ] **登录成功后**：`AuthContext` 中 `isAuthenticated` 为 `true`，`token` 非空

---

## 三、C 端核心链路验收（丙负责功能，甲验收达标）

### 3.1 首页 (`/`)

- [ ] **推荐区展示**：调用 `GET /api/v1/recommendations`，展示真实推荐活动（非硬编码）
- [ ] **精选活动**：展示真实活动数据（非 `HOME_SELECTED_ACTIVITIES` 假数据）
- [ ] **国际化**：中英文切换正常，文案来自 `i18n/locales/*.json`

### 3.2 活动广场 (`/activities`)

- [ ] **列表展示**：调用 `GET /api/v1/activities`，展示真实活动列表
- [ ] **筛选功能**：`keyword`、`region`、`category`、`sort` 参数生效
- [ ] **分页功能**：`page`、`page_size` 参数生效，翻页正常
- [ ] **URL 同步**：筛选条件反映在 URL 查询参数中，刷新/分享/前进后退保持状态

### 3.3 活动详情 (`/activities/:id`)

- [ ] **详情展示**：调用 `GET /api/v1/activities/:id`，展示真实活动详情
- [ ] **库存显示**：`MaxCapacity` 与 `EnrollCount` 正确显示
- [ ] **报名按钮**：
  - 未登录：点击跳转 `/login`
  - 已登录：点击调用 `POST /api/v1/enrollments`
  - 成功受理（202 + code 1201）：显示排队提示
  - 库存不足（200 + code 1101）：显示售罄提示
  - 重复报名（409）：显示已报名提示

### 3.4 登录与鉴权 (`/login`)

- [ ] **登录表单**：输入 seed 账号（如 `13800000001` / `test123456`），提交成功
- [ ] **Token 存储**：登录后 `localStorage` 中存在 `token`，`AuthContext` 同步更新
- [ ] **登录后跳转**：自动跳转到 `/app/overview` 或原访问页面
- [ ] **登出功能**：点击登出，清空 token，跳转 `/login`

---

## 四、商户端与通知验收（丁负责功能，甲验收达标）

### 4.1 商户控制台 (`/merchant/*`)

- [ ] **商户登录**：使用 seed 中 `Role=MERCHANT` 账号登录（如 `13800000004` / `test123456`）
- [ ] **活动列表**：`GET /api/v1/merchant/activities`，展示商户自己的活动
- [ ] **创建活动**：填写表单，`POST /api/v1/merchant/activities`，成功创建
- [ ] **编辑活动**：修改活动，`PUT /api/v1/merchant/activities/:id`，成功更新
- [ ] **发布活动**：`POST /api/v1/merchant/activities/:id/publish`，状态变为 `PUBLISHED`
- [ ] **错误反馈**：表单校验失败、后端错误等，UI 正确显示错误提示

### 4.2 通知系统 (`/app/notifications`)

- [ ] **通知列表**：`GET /api/v1/notifications`，展示用户通知（分页）
- [ ] **未读数**：`GET /api/v1/notifications/unread-count`，显示未读数字
- [ ] **标记已读**：点击通知，调用 `POST /api/v1/notifications/:id/read`，未读数减少
- [ ] **通知铃铛**：全局 `NotificationBell` 组件显示未读数，点击跳转通知页

---

## 五、压测与监控验收

### 5.1 JMeter 压测执行

- [ ] **准备 tokens.csv**：
  - 使用 seed 账号登录获取至少 10 个有效 token
  - 填入 `tools/jmeter/tokens.csv`（每行一个，无 Bearer 前缀）

- [ ] **修改 ACTIVITY_ID**：
  - 在 `.jmx` 中将 `<stringProp name="ACTIVITY_ID">` 改为 seed 中已发布且有库存的活动 ID

- [ ] **执行基线压测（100 并发）**：
  ```bash
  cd tools/jmeter
  jmeter -n -t enrollment-load.jmx -l results-100.jtl -e -o report-100/
  ```
  - 查看 `report-100/index.html`，确认：
    - **成功率**：202（受理）+ 200（库存不足）+ 409（重复）计入成功，总成功率 > 95%
    - **响应时间**：P95 < 500ms（视后端性能调整）
    - **错误率**：5xx 错误 < 1%

- [ ] **执行峰值压测（1000 并发，可选）**：
  - 在 `.jmx` 中启用 `峰值压测 1000 并发` 线程组，禁用基线线程组
  - 重新执行，观察系统表现

### 5.2 后端库存一致性检查

- [ ] **压测后检查 Redis**：
  - 连接 Redis：`redis-cli` 或 `docker exec -it <redis_container> redis-cli`
  - 查询库存键：`GET activity:1:stock`（替换为实际 activity_id）
  - **验证**：剩余库存 >= 0（不为负数）
  - **验证**：`MaxCapacity - EnrollCount` 与 Redis stock 一致

- [ ] **压测后检查 MySQL**：
  - 查询报名表：`SELECT COUNT(*) FROM enrollments WHERE activity_id = 1 AND status = 'SUCCESS';`
  - **验证**：成功报名数 <= `MaxCapacity`
  - **验证**：无重复报名（同一 `user_id` + `activity_id` 仅一条 `SUCCESS` 记录）

### 5.3 监控观测（若环境已接 Grafana）

- [ ] **访问 Grafana**：`http://localhost:3000`（或团队约定地址）
- [ ] **观测指标**：
  - HTTP 请求时延曲线：压测期间无异常尖刺
  - Kafka Consumer Lag：消费延迟在可接受范围内
  - 系统资源：CPU、内存无异常飙升

---

## 六、契约与接口对齐检查

### 6.1 响应码与业务码对齐

与乙同学确认以下契约：

| 场景 | HTTP 状态码 | 业务码 (code) | 前端处理 |
|------|------------|--------------|---------|
| 报名受理成功（排队） | 202 | 1201 | 显示排队提示 |
| 库存不足 | 200 | 1101 | 显示售罄提示 |
| 重复报名 | 409 | - | 显示已报名提示 |
| 活动不存在 | 404 | - | 显示错误提示 |
| 报名通道未开放 | 400 | - | 显示错误提示 |
| 未授权 | 401 | - | 清空 token，跳转登录 |

- [ ] **前端处理逻辑**：与上表一致，无遗漏
- [ ] **后端响应格式**：符合 `pkg/response` 规范

### 6.2 字段类型与序列化

- [ ] **Int64 精度**：`activity_id`、`user_id` 等大整数字段无精度溢出（前端使用 `string` 或 `number` 正确处理）
- [ ] **时间戳格式**：`enrolled_at`、`activity_at` 等时间字段为 ISO 8601 或 Unix 时间戳，前端正确解析
- [ ] **枚举值**：`status`、`category`、`role` 等枚举字段前后端一致

---

## 七、边界与异常场景检查

- [ ] **网络异常**：断开后端服务，前端显示友好错误提示（非白屏）
- [ ] **空数据**：清空数据库，列表页显示"暂无数据"而非报错
- [ ] **超长输入**：表单输入超长字符串，前端校验或后端返回 400
- [ ] **并发冲突**：多用户同时报名同一活动，无负库存、无重复报名
- [ ] **Token 过期**：模拟过期 token，前端正确处理 401 并跳转登录

---

## 八、文档与代码规范检查

- [ ] **代码提交规范**：Commit 信息符合 `CONTRIBUTING.md` 约定（如 `feat:`, `fix:`, `test:`）
- [ ] **分支策略**：功能分支已合并到集成分支（如 `develop` 或 `main`）
- [ ] **代码审查**：关键 PR 已通过 Code Review
- [ ] **文档更新**：`FRONTEND_SPEC.md`、`README.md` 等文档与代码同步

---

## 九、验收结论

### 9.1 验收通过标准

- [ ] **所有核心链路**（首页、广场、详情、报名、登录、商户、通知）功能正常
- [ ] **压测通过**：100 并发无异常，库存一致性验证通过
- [ ] **契约对齐**：前后端响应码、字段类型、业务逻辑一致
- [ ] **无阻断性 Bug**：无 5xx 错误、无白屏、无数据丢失

### 9.2 验收记录

**执行日期：** `____年____月____日`  
**执行人：** 同学甲  
**验收结果：** ☐ 通过 / ☐ 不通过  
**备注：**

```
（记录验收过程中发现的问题、与乙/丙/丁的沟通记录、压测数据截图等）
```

---

## 十、附录：常见问题排查

### Q1: 前端请求被 MSW 拦截，无法联调

**A:** 检查 `frontend/.env` 中 `VITE_USE_MOCK=false`，重启 `pnpm dev`，清除浏览器缓存并 unregister Service Worker。

### Q2: 压测时 401 错误率高

**A:** 检查 `tokens.csv` 中 token 是否有效（未过期），或增加 token 数量（至少与线程数相同）。

### Q3: 压测后 Redis 库存为负数

**A:** 后端 Lua 脚本或事务逻辑有问题，联系一组排查 `enrollment_service.go` 与 Redis 原子操作。

### Q4: 前端显示"已报名"但后端无记录

**A:** 检查前端是否缓存了旧状态，或后端事务回滚但未通知前端，联系乙排查 API 响应逻辑。

### Q5: Grafana 无数据

**A:** 检查后端是否暴露 Prometheus metrics 端点（如 `/metrics`），Prometheus 是否正确抓取，Grafana 数据源配置是否正确。

---

**清单版本：** v1.0  
**最后更新：** 2026-04-13  
**维护人：** 同学甲（第二组联调）
