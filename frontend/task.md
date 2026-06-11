# Task List: Frontend Current Snapshot

- [x] Authentication foundation
  - [x] `src/context/AuthContext.tsx` 管理登录态、用户信息与登出同步。
  - [x] `src/components/ProtectedRoute.tsx` 保护 `/orders`、`/notifications`、`/profile`、`/settings` 及商户路由。
  - [x] `src/api/axios.ts` 统一注入 Bearer Token，并在 `401` 时清理会话后跳转 `/login`。

- [x] Public experience
  - [x] `src/layouts/PublicLayout.tsx` 提供公共头部、底部、搜索入口与城市上下文。
  - [x] 首页、公开活动列表、活动详情页已接入当前页面结构。
  - [x] 首页推荐区、通知铃铛、分页与空态组件已拆分到 `components/public/`。

- [x] User center
  - [x] `src/pages/Orders.tsx`、`src/pages/OrderDetail.tsx` 已覆盖订单列表与详情流转。
  - [x] `src/pages/Notifications.tsx` 已对接通知列表、未读数与已读动作。
  - [x] `src/pages/Profile.tsx`、`src/pages/Settings.tsx` 已纳入受保护路由。
  - [x] `src/pages/EnrollStatus.tsx` 已提供报名结果状态页。

- [x] Merchant experience
  - [x] `src/pages/MerchantDashboard.tsx`、`src/pages/MerchantActivities.tsx`、`src/pages/MerchantActivityNew.tsx`、`src/pages/MerchantActivityEdit.tsx` 已建立商户端主流程。
  - [x] `src/components/MerchantForm.tsx` 承载活动创建/编辑表单。
  - [x] 商户端辅助组件已拆分到 `components/merchant/`。

- [x] API and mocks
  - [x] `src/api/endpoints/` 已按活动、认证、报名、订单、通知、推荐拆分请求层。
  - [x] `src/mocks/handlers/` 已提供对应 MSW handlers。
  - [x] `src/types/` 已建立主要业务类型定义。

- [x] Verification baseline
  - [x] `vitest` 已覆盖 axios 拦截器与部分 endpoint 行为。
  - [x] 路由中保留旧路径重定向兼容，如 `/app/*`、`/dashboard` 到当前公开站点结构。
