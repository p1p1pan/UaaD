# UAAD 团队协同开发方案

**目标：** 多人并行开发、冲突最小、代码质量可控
**更新日期：** 2026-04-01

---

## 1. 冲突热力图：哪些文件最容易打架

基于对现有代码的分析，以下是**高冲突风险文件**：

| 文件 | 冲突风险 | 原因 | 多少人会碰 |
|---|---|---|---|
| `backend/cmd/server/main.go` | 🔴 极高 | DI 装配 + 路由注册 → 每个人都要加一行 | 所有人 |
| `frontend/src/App.tsx` | 🔴 极高 | 路由注册 → 每个新页面都要加一行 | 所有人 |
| `frontend/src/api/axios.ts` | 🔴 高 | 全局拦截器 → 每个人都可能改 | 所有人 |
| `backend/internal/domain/*.go` | 🟡 中 | 每个模块新增一个 entity 文件，不冲突文件名 | 每人一份 |
| `backend/internal/handler/*.go` | 🟢 低 | 各模块独立文件 | 1 人/模块 |
| `backend/internal/service/*.go` | 🟢 低 | 各模块独立文件 | 1 人/模块 |
| `backend/internal/repository/*.go` | 🟢 低 | 各模块独立文件 | 1 人/模块 |
| `frontend/src/pages/*.tsx` | 🟢 低 | 每个页面独立文件 | 1 人/页 |

**核心发现：** 最大的冲突源是 `main.go`（后端路由/DI 入口）和 `App.tsx`（前端路由入口）。

---

## 2. 解决方案：模块隔离 + API 契约先行

### 2.1 后端：每个模块自成闭环，main.go 只改一次

```
backend/internal/
├── domain/              # 每人加一个文件 → 无冲突
│   ├── user.go          ← 已有 (BE-04)
│   ├── activity.go      ← BE-A2 做
│   ├── enrollment.go    ← BE-E1 做
│   ├── order.go         ← BE-O1 做
│   ├── behavior.go      ← RE-1 做
│   └── notification.go  ← BE-N1 做
├── repository/          # 每人一个文件 → 无冲突
├── service/             # 每人一个文件 → 无冲突
├── handler/             # 每人一个文件 → 无冲突
└── middleware/          # 每人一个文件 → 无冲突
    ├── auth.go          ← INF-2 做 (JWT 鉴权中间件)
    └── request_id.go    ← INF 做
```

**main.go 只由一个人（Tech Lead / 基础设施负责人）负责合并。** 
其他开发者在自己的 `*_setup.go` 文件中定义路由注册函数，最后 infrastructure 负责人统一调用：

```go
// handler/activity_setup.go — 开发人员只写这个
func RegisterActivityRoutes(r *gin.RouterGroup, handler *ActivityHandler) {
    activities := r.Group("/activities")
    {
        activities.GET("", handler.List)
        activities.GET("/:id", handler.Detail)
        activities.POST("", handler.Create)  // 权限中间件在 handler 内部检查
    }
}

// handler/enrollment_setup.go — 另一个开发人员写这个
func RegisterEnrollmentRoutes(r *gin.RouterGroup, handler *EnrollmentHandler) {
    enroll := r.Group("/enrollments")
    {
        enroll.POST("", handler.Create)
        enroll.GET("/:id", handler.GetStatus)
    }
}

// cmd/server/main.go — 只有 infrastructure 负责人改这个
// （合并时一次性加入所有模块）
func main() {
    // ... DB init, DI ...
    
    activityHandler := handler.NewActivityHandler(activitySvc)
    handler.RegisterActivityRoutes(v1, activityHandler)
    
    enrollmentHandler := handler.NewEnrollmentHandler(enrollSvc)
    handler.RegisterEnrollmentRoutes(v1, enrollmentHandler)
    
    // ...
}
```

### 2.2 前端：页面级隔离 + API 契约定义

```
frontend/src/
├── api/
│   ├── axios.ts                  ← 只由 Tech Lead 改（全局配置）
│   └── endpoints/                ← 每人一个文件 → 无冲突
│       ├── auth.ts               ← FE-A1 做
│       ├── activity.ts           ← FE-A2 做
│       ├── enrollment.ts         ← FE-E1 做
│       └── recommendation.ts     ← FE-R1 做
├── pages/                        ← 每人一个文件 → 无冲突
│   ├── Login.tsx                 ← 已有
│   ├── Register.tsx              ← 已有
│   ├── ActivityList.tsx          ← FE-A2 做
│   ├── ActivityDetail.tsx        ← FE-A3 做
│   ├── EnrollStatus.tsx          ← FE-E1 做
│   └── MerchantDashboard.tsx     ← FE-M1 做
├── components/                   ← 独立组件文件
│   ├── ActivityCard.tsx          ← FE-C1
│   ├── EnrollButton.tsx          ← FE-E1
│   └── ActivityCountdown.tsx     ← FE-C2
└── App.tsx                       ← 只由 Frontend Lead 改
```

**App.tsx 由前端负责人统一管理：**
开发人员只提交页面/组件文件，前端负责人汇总路由：

```tsx
// 开发人员：只管写自己的页面组件
// import ActivityDetail from './pages/ActivityDetail';
// 前端负责人：统一注册路由
```

### 2.3 API 契约：开发者的边界协议

**原则：** API 定义 = 团队契约。前端 Mock 按契约开发，后端按契约实现，互不等待。

每次新增接口，先在 SYSTEM_DESIGN.md 中定义，然后同步到前端 MSW Handler：

```typescript
// src/mocks/handlers.ts — 前端开发人员自己加 Mock
export const handlers = [
  // 🔒 auth 接口 -> bypass，走真实后端
  // --- 以下为新增 ---
  http.get('/api/v1/activities', () => {
    return HttpResponse.json({
      code: 0,
      data: { list: mockActivities, total: 50, page: 1, page_size: 20 }
    });
  }),
  http.post('/api/v1/enrollments', () => {
    return HttpResponse.json(
      { code: 1201, message: '已进入排队队列', data: { enrollment_id: 1, queue_position: 3482, status: 'QUEUING' } },
      { status: 202 }
    );
  }),
];
```

---

## 3. 依赖图：什么任务依赖什么

### 3.1 前端依赖树

```
FE-01 项目骨架 (✅ 已完成)
    └── FE-02 API 模块定义 ──────────────┐
    └── FE-03/04 登录注册页面 (✅ 已完成)  │
                                          ├── FE-Ax 活动模块页面
                                          │   ├── 需要: activity.ts API 定义
                                          │   ├── 需要: ActivityCard 组件
                                          │   └── 需要: MSW Mock
                                          │
                                          ├── FE-Ex 报名模块页面
                                          │   ├── 需要: enrollment.ts API 定义
                                          │   ├── 需要: EnrollButton 组件
                                          │   ├── 需要: ActivityCountdown 组件
                                          │   └── 依赖: FE-Ax (需要先有活动页面)
                                          │
                                          ├── FE-Mx 商户模块页面
                                          │   ├── 需要: merchant API 定义
                                          │   └── 可以并行开发
                                          │
                                          └── FE-Rx 推荐模块页面
                                              ├── 需要: recommendation.ts API 定义
                                              └── 可以并行开发（复用 ActivityCard）
```

### 3.2 后端依赖树

```
BE-03/04 注册登录 (✅ 已完成)
  └── INF-1 JWT 鉴权中间件 ← 所有需要鉴权的接口依赖
  └── INF-2 统一响应包 ← 所有接口依赖
  └── INF-3 配置管理 ← 生产就绪前提
  
    ├── BE-Ax 活动模块
    │   ├── domain/activity.go
    │   ├── repository/activity_repository.go
    │   ├── service/activity_service.go
    │   ├── handler/activity_handler.go
    │   └── 依赖: DB Migration (新增 activities 表)
    │
    ├── BE-Ex 报名模块
    │   ├── domain/enrollment.go
    │   ├── repository/enrollment_repository.go
    │   ├── service/enrollment_service.go
    │   ├── handler/enrollment_handler.go
    │   └── 依赖: BE-Ax 活动存在 + Redis (库存扣减)
    │
    ├── BE-Ox 订单模块
    │   ├── domain/order.go
    │   ├── repository/order_repository.go
    │   ├── service/order_worker.go
    │   ├── handler/order_handler.go
    │   └── 依赖: BE-Ex 报名成功触发
    │
    └── RE-x 推荐模块
        ├── domain/behavior.go
        ├── domain/activity_score.go
        ├── repository/behavior.go
        ├── repository/recommendation.go
        ├── service/recommendation.go
        ├── handler/behavior_handler.go
        └── 依赖: BE-Ax 活动查询 (展示推荐结果)
```

### 3.3 并行矩阵

| Sprint | 可同时进行的开发流 | 负责人 |
|---|---|---|
| Sprint 1 | INF-1 JWT 中间件 + FE-A0 API 端点定义 + DB Migration | Infra Team |
| Sprint 2 | BE-Activity(1人) ↔ BE-Enrollment(1人) ↔ FE-Activity(1人) ↔ FE-Merchant(1人) | 4 人并行 |
| Sprint 3 | BE-Enrollment 抢票(1人) ↔ BE-Order(1人) ↔ FE-Enroll 前端(1人) | 3 人并行 |
| Sprint 4 | BE-Recommend(1人) ↔ FE-Recommend(1人) | 2 人并行 |
| Sprint 5 | 压测 + E2E + 联调修 bug | 全员 |

> **关键观察：** 从 Sprint 2 开始，后端 A/E/O/R 四个模块可以完全并行开发。每个模块有自己的 domain/repository/service/handler/路由注册函数。

---

## 4. 分支策略：Git Flow 简化版

```
main (稳定可发布)
  └── dev (集成开发)
        ├── feature/auth-jwt          (Infra 负责人)
        ├── feature/activity-backend  (后端 A)
        ├── feature/enrollment-backend (后端 E)
        ├── feature/activity-frontend  (前端 A)
        ├── feature/merchant-frontend  (前端 M)
        ├── feature/recommendation     (推荐 R)
        └── ...
```

**规则：**

| 规则 | 说明 |
|---|---|
| 不直接向 `main` 提交 | `main` 永远是可发布状态 |
| 所有开发在 `feature/*` 分支 | 每个功能一个分支 |
| 合并到 `dev` 需要 PR + Review | 保证代码质量 |
| 每日同步 `dev` → `feature` | `git merge origin/dev`，避免大合并 |
| feature 分支不超过 3 天 | 频繁合并减少冲突累积 |
| 冲突由 PR 发起方解决 | 谁发起谁负责 |

---

## 5. 任务分工明细表

### Sprint 1: 基础准备 (2-3 天) — 必须先完成

| ID | 任务 | 文件影响 | 依赖 | 负责人 |
|---|---|---|---|---|
| **INF-1** | JWT 鉴权中间件 | `middleware/auth.go` + `handler/auth_handler.go`（login 返回格式调整） | 无 | 后端负责人 |
| **INF-2** | 统一响应包 (`pkg/response`) | `pkg/response/response.go` + 所有 handler 适配 | 无 | 后端负责人 |
| **INF-3** | 配置管理 (`internal/config`) | `config/config.go`、`.env`、`go.mod`(dotenv 库) | 无 | 后端负责人 |
| **INF-4** | API 端点定义 (前端 TypeScript) | `api/endpoints/auth.ts` | 无 | 前端负责人 |
| **INF-5** | JWT decode + 类型定义 | `types/index.ts` + `context/AuthContext.tsx`（decode token 获取 user_id/role） | 无 | 前端负责人 |
| **DB-1** | DB Migration 骨架 | `migrations/001_users.up.sql`（现有 GORM 迁移的 SQL 对照） | 无 | 后端负责人 |

> ✅ Sprint 1 完成后，后端所有模块开发人员可以开始，前端所有页面开发人员也可以开始

### Sprint 2: 活动模块 (5-7 天) — 4 人并行

| ID | 任务 | 文件 | 依赖 |
|---|---|---|---|
| **BE-A1** | 活动 domain model | `domain/activity.go` | Sprint 1 INF |
| **BE-A2** | 活动 repository | `repository/activity_repository.go` | BE-A1 |
| **BE-A3** | 活动 service (CRUD + 上架预热) | `service/activity_service.go` | BE-A2 |
| **BE-A4** | 活动 handler (所有 API) | `handler/activity_handler.go` + `_setup.go` | BE-A3 |
| **BE-A5** | DB Migration 活动相关 | `migrations/002_activities.up.sql` | BE-A1 |
| **FE-A1** | API 端点定义 | `api/endpoints/activity.ts` | Sprint 1 INF-4 |
| **FE-A2** | 活动广场页面 | `pages/ActivityList.tsx` | FE-A1 |
| **FE-A3** | 活动详情页面 | `pages/ActivityDetail.tsx` | FE-A1 |
| **FE-A4** | ActivityCard 组件 | `components/ActivityCard.tsx` | — |
| **FE-M1** | 商户控制台 + 创建活动 | `pages/MerchantDashboard.tsx` + `MerchantForm.tsx` | FE-A1 |
| **MSW** | 活动/商户模块 Mock | `mocks/handlers.ts` 扩展 | — |

### Sprint 3: 报名/订单模块 (5-7 天) — 3 人并行

| ID | 任务 | 文件 | 依赖 |
|---|---|---|---|
| **BE-E1** | 报名 domain + repository | `domain/enrollment.go` + `repository/enrollment_repository.go` | BE-Ax |
| **BE-E2** | 报名 service (Lua 扣减逻辑) | `service/enrollment_service.go` | BE-E1 + Redis 集成 |
| **BE-E3** | 报名 handler | `handler/enrollment_handler.go` + `_setup.go` | BE-E2 |
| **BE-O1** | 订单 domain + repository | `domain/order.go` + `repository/order_repository.go` | BE-Ax |
| **BE-O2** | 订单 Worker (消费 + 冲正) | `service/order_worker.go` | BE-O1, BE-E1 |
| **BE-O3** | 订单 handler | `handler/order_handler.go` | BE-O1 |
| **FE-E1** | 报名按钮 + 排队动画 | `components/EnrollButton.tsx` + `pages/EnrollStatus.tsx` | FE-A3 (详情页) |
| **FE-E2** | 订单列表页面 | `pages/Orders.tsx` | — |
| **Redis** | Redis 集成 (StockManager) | `pkg/redistool/stock.go` + Lua 脚本 | — |

### Sprint 4: 推荐模块 (5 天) — 2 人并行

| ID | 任务 | 文件 | 依赖 |
|---|---|---|---|
| **RE-1** | 行为埋点 domain + handler | `domain/behavior.go` + `handler/behavior_handler.go` | — |
| **RE-2** | 热度评分算法 + cron | `service/scoring.go` | BE-Ax, user_behaviors |
| **RE-3** | 推荐列表 API | `handler/recommendation_handler.go` | RE-2 |
| **FE-R1** | 推荐首页改造 | `pages/Dashboard.tsx` (添加推荐瀑布流) | — |
| **FE-R2** | 用户行为埋点 hook | `hooks/useBehaviorTracker.ts` | FE-R1 |

### Sprint 5: 压测与打磨 (5 天) — 全员

| ID | 任务 | 负责人 |
|---|---|---|
| **TEST-1** | JMeter 压测脚本 (抢票接口) | 后端 |
| **TEST-2** | E2E Playwright 测试 | 前端 |
| **TEST-3** | Docker Compose 部署 | Infra |
| **TEST-4** | 压测报告 + 瓶颈修复 | 全员 |
| **TEST-5** | API 文档 (Swagger) + 部署文档 | PM/Tech Lead |

---

## 6. 最小化冲突的具体措施

### 6.1 禁止直接改 main.go / App.tsx

```
✅ 正确做法：
  - 后端开发者在 handler/ 目录写 RegisterXXXRoutes() 函数
  - 前端开发者在 pages/ 目录下写页面组件
  - 每周一次由负责人统一合并到 main.go / App.tsx

❌ 错误做法：
  - 每个开发者各自 fork main.go 加路由
```

### 6.2 文件级互斥表

| 开发者 A 在改... | 开发者 B 可以同时改... | 冲突点 |
|---|---|---|
| `handler/activity_handler.go` | `handler/enrollment_handler.go` | ❌ 无冲突 |
| `domain/activity.go` | `domain/enrollment.go` | ❌ 无冲突 |
| `repository/activity_repo.go` | `repository/enrollment_repo.go` | ❌ 无冲突 |
| `service/activity_service.go` | `service/enrollment_service.go` | ❌ 无冲突 |
| `pages/ActivityList.tsx` | `pages/ActivityDetail.tsx` | ❌ 无冲突 |
| `main.go` | **任何人都不应该同时改 main.go** | 🔴 只能一个人改 |
| `App.tsx` | **任何人都不应该同时改 App.tsx** | 🔴 只能一个人改 |

### 6.3 沟通节奏

| 频率 | 内容 | 形式 |
|---|---|---|
| 每天 1 次 (15min) | 站立会：昨天做了什么、今天做什么、遇到什么阻塞 | 飞书群/语音 |
| 每 2 天 1 次 | API 对齐：前端 Mock → 后端实现，验证响应体一致 | PR Review |
| Sprint 结束 | 集成测试：各模块合并到 `dev`，全链路跑通 | 本地 Docker |
| 随时 | API 变更讨论：必须先在群内通知 + 更新 SYSTEM_DESIGN.md | 飞书群 |

### 6.4 代码审查规则

- **每个 PR 至少 1 人 Review**（同组交叉 Review：A 写 B 审）
- **PR 必须包含**：
  - 变更描述（改了哪个模块的哪个文件）
  - 验证方式（`curl` 截图 / 前端页面截图）
  - 关联的 API 契约链接（指向 SYSTEM_DESIGN.md 哪一节）
- **CI 检查（如果有的话）**：`go build` + `go vet` + 前端 `tsc` 无报错

---

## 7. AI 协作特别建议

由于项目采用 **AI 辅助开发**，每个开发者可能有 AI 助手：

1. **每个开发者把自己的 AI 当作结对编程伙伴**——AI 写代码，开发者 Review
2. **设计文档（SYSTEM_DESIGN.md）是所有 AI 的共同上下文**——AI 生成代码必须遵循文档中的 API 契约
3. **不要让多个 AI 同时改同一个文件**——AI 生成的代码质量参差不齐，需要人工把关
4. **commit mesage 规范**：`feat(activity): add activity list handler and repository`（模块名必须写）
