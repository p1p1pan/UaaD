# UAAD 文档与提示词治理说明

**目标：** 让项目文档、AI 提示词、工作流配置有稳定的单一真理源，避免“同一内容分散多处、改了一份漏了三份、引用还指向旧文件”。

**适用范围：**
- 项目文档
- AI Agent 指令 / Prompt / Workflow / Skill
- OpenSpec 变更文档

---

## 1. 单一真理源

### 1.1 项目文档

以下目录是项目文档真理源：

| 路径 | 用途 | 是否可直接修改 |
|---|---|---|
| `docs/` | 需求、架构、协作、运行、压测、设计说明 | 是 |
| `frontend/FRONTEND_SPEC.md` | 前端开发规范 | 是 |
| `backend/task.md` / `frontend/task.md` | 模块任务清单 | 是 |
| `openspec/` | 变更提案、设计、任务、规范增量 | 是 |

说明：
- 涉及需求范围，先改 `docs/SRS.md`
- 涉及 API / 状态机 / 数据流，先改 `docs/SYSTEM_DESIGN.md`
- 涉及数据库结构，改 `docs/DDL.md`，必要时同步 `docs/SYSTEM_DESIGN.md`
- 涉及阶段性变更方案，优先落在 `openspec/changes/<change>/`

### 1.2 AI Prompt / Workflow

以下目录是 AI 协作资产真理源：

| 路径 | 用途 | 是否可直接修改 |
|---|---|---|
| `.agents/workflows/` | 团队维护的通用 AI 工作流 | 是 |
| `.agents/skills/` | 团队维护的技能与参考材料 | 是 |
| `.github/copilot-instructions.md` | GitHub Copilot 全局入口说明 | 是，但应引用真理源而非重复定义 |

以下目录默认视为**适配层 / 分发副本 / 工具兼容目录**：

| 路径模式 | 说明 | 默认策略 |
|---|---|---|
| `.github/prompts/` | GitHub Prompt 文件 | 仅做 GitHub 适配 |
| `.github/skills/` | GitHub Skills 分发副本 | 仅做 GitHub 适配 |
| `.cursor/` `.cline/` `.continue/` `.roo/` `.qwen/` `.gemini/` `.kiro/` `.amazonq/` `.augment/` `.windsurf/` `.codex/` `.agent/` 等 | 各工具/Agent 的兼容目录 | 非必要不直接改 |

规则：
- 如果某条规则是“团队共识”，优先写进 `.agents/` 或 `docs/`
- 如果某个工具需要专属格式，再从真理源分发到对应目录
- 不要把业务规范分别写进每个工具目录里独立维护

---

## 2. 更新顺序

涉及文档或提示词变更时，按下面顺序处理：

1. 修改真理源
2. 修正入口文档中的引用
3. 必要时同步到工具适配目录
4. 自查是否仍有失效路径、过时文件名、重复定义

一句话原则：

> 先改源头，再改入口，最后才改镜像。

---

## 3. OpenSpec 使用要求

OpenSpec 是本项目管理非琐碎变更的默认流程。它不替代长期文档，而是记录“变更过程中的提案、设计、任务和可验收需求”。

### 3.1 必须使用 OpenSpec 的场景

下面这些变更必须先进入 `openspec/changes/<change-name>/`：

- 新增或改变业务能力
- 修改 API 契约、状态机、错误码或响应结构
- 修改数据库结构、核心数据流或跨端联调方式
- 做跨模块重构、目录结构调整、治理规则调整
- 修改文档体系、Prompt 体系、AI Workflow 或 OpenSpec 管理规则
- 需要多人评审、分阶段执行、后续归档的非琐碎改动

### 3.2 可以不使用 OpenSpec 的场景

下面这些变更可以直接修改：

- 修复错别字、格式、断链
- 不改变行为的注释、文案、局部说明
- 单文件、低风险、无协作影响的小修补

### 3.3 标准产物

一个标准 OpenSpec change 通常包含：

| 文件 | 作用 |
|---|---|
| `proposal.md` | 说明为什么做、做什么、影响范围 |
| `design.md` | 说明怎么做、关键决策、风险和非目标 |
| `tasks.md` | 拆解可执行任务，使用 checkbox 跟踪进度 |
| `specs/<capability>/spec.md` | 描述可验收需求和场景 |

### 3.4 使用流程

推荐流程：

1. `openspec list --json` 查看当前活跃变更
2. `openspec new change "<change-name>"` 创建新变更
3. `openspec status --change "<change-name>" --json` 查看需要补齐的 artifact
4. 使用 `openspec instructions <artifact> --change "<change-name>" --json` 获取编写要求
5. 补齐 `proposal.md`、`design.md`、`specs/**/spec.md`、`tasks.md`
6. 使用 `openspec instructions apply --change "<change-name>" --json` 进入实现阶段
7. 每完成一项任务就更新 `tasks.md`
8. 完成后验证、归档，并把稳定结论同步到长期文档或主 spec

### 3.5 与长期文档的关系

- `openspec/changes/<change>/` 记录变更过程
- `openspec/specs/` 记录已沉淀的 capability 需求
- `docs/` 记录长期稳定的项目事实
- change 完成后，不能只停留在 `openspec/changes/`；稳定结论应回写到 `docs/` 或主 spec

---

## 4. 目录职责

### `docs/`

放“项目事实”和“协作规则”，不放工具专属 prompt 副本。

建议内容类型：
- 需求规格
- 系统设计
- DDL / 数据约束
- 运行与联调指南
- Sprint / walkthrough / 压测记录
- 仓库治理说明

### `.agents/`

放“团队自己维护的 AI 协作资产”。

建议内容类型：
- 通用工作流
- 统一约束
- 技能参考资料
- 需要被多个工具复用的原始说明

### `openspec/`

放“正在变化中的设计与任务”。

适合内容：
- change proposal
- design
- tasks
- delta spec

不适合内容：
- 与某次变更无关的长期团队规范
- 工具私有 prompt

---

## 5. 编写规范

### 文档命名

- 长期文档使用稳定名称，例如 `SYSTEM_DESIGN.md`
- 流程类说明优先用明确名称，例如 `RUN_GUIDE.md`
- 治理类说明使用直白名称，不用过度抽象缩写

### Prompt / Workflow 命名

- 统一用动作导向命名，例如 `opsx-apply`、`skill-prompt-frontend`
- 同一能力在不同工具中的文件名尽量一致
- 若某工具受格式限制，保留能力名一致，后缀按工具约定变化

### 引用规范

- 不引用仓库里不存在的文件
- 不在多个入口文档中分别描述同一条详细规则
- 详细规则写一处，其余位置只做索引和跳转

---

## 6. 当前仓库的执行约定

当前仓库先采用下面这套约定：

- `docs/` 是项目文档真理源
- `.agents/` 是团队 AI 工作流真理源
- `.github/copilot-instructions.md` 只保留 GitHub Copilot 的入口性约束
- `.github/prompts/`、`.github/skills/` 与其他工具目录默认视为兼容副本
- 非琐碎变更必须先开 OpenSpec change
- 如需大规模清理这些兼容目录，单独开一次变更，不在日常功能开发中顺手混改

---

## 7. 提交前自检

提交和文档/Prompt 相关的变更前，至少检查：

- 是否修改了真理源，而不是只改镜像
- 是否新增了重复定义
- 是否留下失效链接或不存在的文件名
- README 是否仍能把新人引导到正确入口
- AI 指令是否仍引用当前存在的文档
- 非琐碎变更是否已有对应 OpenSpec change
- OpenSpec `tasks.md` 是否反映当前完成状态

---

## 8. 后续可继续做的整理

这份治理说明先解决“继续失控”的问题。后续还可以继续推进：

- 给 `.agents/` 增加统一索引页，列出所有 workflow / skill 的来源与用途
- 给各工具目录补自动同步脚本，避免手工复制漂移
- 清理明显无主或未启用的工具目录
- 把 `docs/` 内的阶段性文档与长期文档进一步分层
