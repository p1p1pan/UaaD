# 📚 UAAD 项目文档索引

> 面向新加入的开发者、AI Agent 和技术负责人。
> 🔒 = 必读 | 📖 = 按需阅读 | 🔧 = 开发参考

**最后更新：2026-04-01**

---

## 🏃 新人快速上手（按顺序读）

1. 🔒 [SRS.md](#1-需求与设计) → 了解项目是什么
2. 🔒 [SYSTEM_DESIGN.md](#1-需求与设计) → 看懂架构和 API
3. 🔒 [COLLABORATION.md](#2-团队协作) → 知道怎么和人配合
4. 🔧 [CONTRIBUTING.md](#2-团队协作) → 知道怎么提交代码
5. 🔧 [FRONTEND_SPEC.md](#4-前端) → 前端开发规范

---

## 文档导航

### 0. 项目根目录

| 文件 | 说明 |
|------|------|
| `task_list.md` | Alpha 阶段任务工单清单（Issue 录入用） |
| `CONTRIBUTING.md` | 贡献指南 — 分支/commit 格式、AI 协作原则、技术栈速览 |

---

### 1. 需求与设计 📐

> 📍 `docs/`

| 文件 | 大小 | 必读？ | 内容 | 适合谁 |
|------|------|--------|------|--------|
| **SRS.md** | 11KB | 🔒 | 软件需求规格说明：项目背景、用户类型、功能需求、非功能指标、迭代规划 | 全员、新人 |
| **SYSTEM_DESIGN.md** | 65KB | 🔒 | 系统架构设计：分层架构、数据库 DDL、完整 API 契约、时序图、抢票引擎、推荐算法、部署架构、前端路由 | 全员（最常查阅） |
| **DDL.md** | 10KB | 🔒 | 数据库 DDL 汇总：7 张表的完整建表语句 + Redis 键位约定 + GORM 对齐清单 | 后端、数据 |
| **TICKET_ENGINE_DESIGN.md** | 17KB | 📖 | 抢票引擎深度设计：并发控制、排队算法、Lua 库存扣减细节 | 后端抢票开发 |
| **RECOMMENDATION_DESIGN.md** | 16KB | 📖 | 推荐引擎设计：热度评分算法、协同过滤、数据流、API 设计 | 后端推荐开发 |
| **COLLABORATION.md** | 17KB | 🔒 | 团队协作开发方案：冲突热力图、模块隔离、Sprint 分工表、分支策略、通信节奏 | 全员、负责人 |
| **wbs.puml** | 6KB | 📖 | 工作分解结构 PlantUML：7 大工作流、150+ 工作包（含 Mock 工程） | 负责人、PM |

---

### 2. 团队协作流程 🤝

> 📍 根目录 & `.github/` & `.agents/`

| 文件 | 说明 | 适合谁 |
|------|------|--------|
| **CONTRIBUTING.md** | 贡献指南 — 分支命名、commit 格式、AI 协作原则、质量要求 | 全员 |
| **.github/PULL_REQUEST_TEMPLATE.md** | PR 模板 — 关联工单、变更描述、执行证据、自查清单 | 全员（提 PR 时必填） |
| **.github/copilot-instructions.md** | AI Agent 全局指令 — SDD 规范驱动开发、禁止超 SRS 开发、强制 TTD | AI Agent、开发者 |
| **.agents/workflows/sdd-standard.md** | SDD 全局规范 — 按需阅读 SRS/ER 校验、环境工具、验证要求 | AI Agent |
| **.agents/workflows/skill-sdd-arch.md** | 架构工作流 — ER 图→DDL→ORM 模型转换规范 | 架构、后端 |
| **.agents/workflows/skill-aitdd-backend.md** | 后端 TDD 工作流 — 并发测试→性能优化→自动迭代循环 | 后端、测试 |
| **.agents/workflows/skill-prompt-frontend.md** | 前端 Prompt 工作流 — NLP→组件生成→浏览器自校验 | 前端、AI Agent |

---

### 3. 后端开发 🟢

> 📍 `backend/`

#### 代码目录

```
backend/
├── cmd/server/main.go              # 入口：DI + 路由（负责人维护）
├── internal/
│   ├── config/config.go            # 配置管理（环境变量 + 默认值）
│   ├── domain/                     # 数据模型（纯结构体）
│   │   ├── user.go                 # 用户表
│   │   ├── activity.go             # 活动表
│   │   ├── enrollment.go           # 报名表
│   │   ├── order.go                # 订单表
│   │   ├── behavior.go             # 用户行为表
│   │   └── notification.go         # 通知表
│   ├── repository/                 # 数据访问层
│   │   ├── user_repository.go
│   │   ├── activity_repository.go
│   │   ├── enrollment_repository.go
│   │   ├── order_repository.go
│   │   └── behavior_repository.go
│   ├── service/                    # 业务逻辑层
│   │   └── auth_service.go         # 认证服务
│   ├── handler/                    # HTTP Handler
│   │   └── auth_handler.go         # 注册/登录/profile
│   └── middleware/                 # 中间件
│       ├── rate_limit.go           # IP 限流
│       └── auth_jwt.go             # JWT 鉴权
├── pkg/                            # 公共工具
│   ├── jwtutil/jwt.go              # JWT 签发/解析
│   └── response/response.go        # 统一 API 响应
├── migrations/                     # DB 迁移脚本 (001~007 up/down)
├── scripts/seed/main.go            # 测试数据 Seed 脚本
├── walkthrough_backend.md          # 后端变更履历
├── task.md                         # 后端任务 Checklist
├── go.mod / go.sum                 # Go 模块依赖
└── uaad.db                         # SQLite 数据库
```

#### 相关文档

| 文件 | 说明 | 必读时机 |
|------|------|----------|
| `backend/walkthrough_backend.md` | 后端变更履历：DB 连接池优化、注册限流实现、验证记录 | 了解已有工作 |
| `backend/task.md` | 后端任务清单（BE-02~BE-05 完成状态） | 跟踪进度 |
| `docs/System_Design.md` 第 4 章 | API 契约（请求/响应/错误码） | 写接口前 |
| `docs/System_Design.md` 第 8 章 | Go Handler 错误处理模板 + response 包规范 | 写 handler 时 |

---

### 4. 前端开发 🔵

> 📍 `frontend/`

#### 代码目录

```
frontend/
├── src/
│   ├── api/axios.ts                # Axios 实例 + 全局拦截器 (401 redirect)
│   ├── context/AuthContext.tsx     # 认证全局状态
│   ├── components/
│   │   ├── ProtectedRoute.tsx      # 路由守卫
│   │   └── LanguageToggle.tsx      # 中英文切换
│   ├── layouts/DashboardLayout.tsx # 仪表盘侧边栏布局
│   ├── pages/
│   │   ├── Login.tsx               # 登录页
│   │   ├── Register.tsx            # 注册页
│   │   ├── Dashboard.tsx           # 仪表盘首页
│   │   ├── Activities.tsx          # 活动列表 🚧
│   │   ├── Profile.tsx             # 个人资料 🚧
│   │   └── Settings.tsx            # 设置 🚧
│   ├── i18n/locales/               # 中英文字典
│   │   ├── zh.json
│   │   └── en.json
│   ├── mocks/                      # MSW Mock Service Worker
│   │   ├── handlers.ts
│   │   └── browser.ts
│   └── App.tsx                     # 路由入口（前端负责人维护）
├── FRONTEND_SPEC.md                # 前端开发规范
├── task.md                         # 前端任务 Checklist
└── README.md                       # React+Vite 脚手架说明
```

#### 相关文档

| 文件 | 说明 | 必读时机 |
|------|------|----------|
| **FRONTEND_SPEC.md** | 前端规范 — 技术栈、AuthContext 数据流、Axios 拦截器、TypeScript 类型、i18n、文件命名 | 前端开发前 |
| `frontend/task.md` | 前端任务清单（AuthContext/ProtectedRoute/拦截器已完成后端验证） | 跟踪进度 |
| `docs/System_Design.md` 第 11 章 | 前端路由表 + 数据流总览 + 核心页面说明 | 加新页面时 |
| `docs/System_Design.md` 第 4 章 | API 契约 | 对接后端时 |

---

### 5. 迁移与数据 🗃️

> 📍 `backend/migrations/`

| 文件 | 说明 |
|------|------|
| `001_users.up.sql` / `001_users.down.sql` | 用户表 |
| `002_activities.up.sql` / `002_activities.down.sql` | 活动表 |
| `003_enrollments.up.sql` / `003_enrollments.down.sql` | 报名表 |
| `004_orders.up.sql` / `004_orders.down.sql` | 订单表 |
| `005_user_behaviors.up.sql` / `005_user_behaviors.down.sql` | 用户行为表 |
| `006_activity_scores.up.sql` / `006_activity_scores.down.sql` | 活动热度评分表 |
| `007_notifications.up.sql` / `007_notifications.down.sql` | 通知表 |

> ⚠️ 当前阶段由 GORM AutoMigrate 负责建表，SQL 文件作为文档和 MySQL 迁移参考。

---

### 6. Sprint 全景图 🗺️

| Sprint | 目标 | 周期 | 并行开发 |
|--------|------|------|----------|
| **Sprint 1** | 基础准备（JWT/响应包/配置/路由对齐） | 2-3 天 | Infra Team |
| **Sprint 2** | 活动模块（CRUD + 上架预热 + B 端商户） | 5-7 天 | 4 人并行 |
| **Sprint 3** | 报名/订单/抢票引擎 | 5-7 天 | 3 人并行 |
| **Sprint 4** | 推荐系统（行为埋点 + 热度 + CF） | 5 天 | 2 人并行 |
| **Sprint 5** | 压测 + E2E + Docker Compose + 文档 | 5 天 | 全员 |

详细说明见 [COLLABORATION.md §5](COLLABORATION.md) 和 [wbs.puml](wbs.puml)。
