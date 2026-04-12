# Walkthrough

## 2026-04-13 · Sprint2 乙同学 API 联调迭代记录

### 变更概览
- 新增前端测试基建（Vitest + jsdom）并接入 `pnpm test` 脚本。
- 在全局 HTTP 层实现 401 登出事件派发，解决仅清理 localStorage 导致的同页鉴权态不同步问题。
- 在全局 HTTP 层实现 `HTTP 200 + code=1101` 的业务失败拦截并转为 reject，避免库存不足误判为成功。
- 新增报名 API 封装与类型：
  - `createEnrollment(activityId)` 对接 `POST /enrollments`，支持 `202 + code=1201` 排队受理。
  - `getEnrollmentStatus(enrollmentId)` 对接 `GET /enrollments/:id/status`。
  - `listMyEnrollments(page,pageSize)` 对接 `GET /enrollments` 分页数据。

### Diff 思路
- 先补测试框架，再做拦截器与 endpoint，保证每次变更都有可执行回归。
- 契约映射策略统一在 endpoint 层处理：后端 snake_case 字段映射为前端 camelCase，页面层不承担字段转换。
- 全局错误语义集中在 axios 拦截器，页面调用方只处理成功对象或 reject 对象，避免分散判断逻辑。

### 验证结果
- `pnpm test`：通过（新增 smoke、401、1101、enrollments endpoint 测试）。
- `pnpm build`：通过。
- `pnpm lint`：存在仓库既有错误（Merchant 页面中的 `react-hooks/set-state-in-effect`），与本次改动无直接关联。
