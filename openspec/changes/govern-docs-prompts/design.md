## Context

UAAD 当前同时使用多类 AI 辅助开发入口，包括 `.agents/`、`.github/`、OpenSpec，以及 `.cursor/`、`.cline/`、`.continue/`、`.qwen/`、`.gemini/`、`.kiro/`、`.amazonq/`、`.augment/`、`.windsurf/`、`.codex/`、`.agent/` 等工具专属目录。

这让团队可以兼容多种工具，但也带来了重复指令、归属不清和规则漂移的问题。当前真正需要解决的不是“存在多个工具目录”本身，而是缺少一套受治理的真理源模型。

当前约束：
- 现有工具目录可能仍被贡献者或本地 Agent 使用。
- 某些生成文件或分发文件会为了兼容性有意重复内容。
- 项目已经使用 `docs/` 管理长期文档，并使用 `openspec/` 管理活跃变更。
- 第一阶段应该先降低混乱，而不是直接做破坏性清理。

## Goals / Non-Goals

**Goals:**

- 明确项目文档和 AI Prompt / Workflow 规则应该在哪里编写。
- 让 README 和贡献指南把贡献者引导到同一套真理源模型。
- 修正主 AI 入口中的失效引用。
- 保留现有工具专属目录，直到后续有专门的清理或分发变更。
- 通过 OpenSpec capability 让治理规则变得可验收。

**Non-Goals:**

- 不删除或重组工具专属兼容目录。
- 不构建自动 Prompt 分发流水线。
- 不在本变更中重写每一份镜像 Prompt 或 Skill。
- 不修改应用代码、API 契约、数据库结构或前端 UX。

## Decisions

### Decision 1: 使用 `docs/` 作为项目文档真理源

需求、系统设计、数据库结构、运行说明、测试指南、协作规则等项目事实，应该放在 `docs/` 或已有的项目级规范文件中，例如 `frontend/FRONTEND_SPEC.md`。

理由：
- 贡献者已经从 README 和 `docs/` 开始了解项目。
- 项目事实应该不依赖任何特定 AI 工具也能被阅读。
- 这样可以避免把面向人的项目知识绑定到工具专属 Prompt 格式上。

备选方案：
- 把所有治理规则都放到 `.agents/`。
- 未采用，因为治理规则不仅服务 AI Agent，也服务人类贡献者。

### Decision 2: 使用 `.agents/` 作为团队维护的 AI Workflow 真理源

团队编写的 Prompt、Workflow、Skill 和可复用 AI 指南，默认应维护在 `.agents/` 下；只有在某个工具要求专属格式时，才同步到工具目录。

理由：
- `.agents/` 已经存在，并且语义上适合作为跨 Agent 资产目录。
- 这样可以避免把 `.github/`、`.cursor/` 或任何单一厂商目录当作全部 AI 行为的唯一权威来源。

备选方案：
- 使用 `.github/` 作为权威来源，因为 GitHub 集成了 PR 和 Copilot。
- 未采用，因为本仓库支持多种 Agent 工具，而不只是 GitHub Copilot。

### Decision 3: 将工具专属目录视为兼容层

`.github/prompts/`、`.github/skills/`、`.cursor/`、`.cline/`、`.continue/`、`.roo/`、`.qwen/`、`.gemini/`、`.kiro/`、`.amazonq/`、`.augment/`、`.windsurf/`、`.codex/`、`.agent/` 等目录默认是兼容层或分发副本，除非后续变更明确提升其地位。

理由：
- 防止贡献者只改某个工具目录，就误以为团队规则已经变更。
- 让现有工具继续可用，同时减少治理上的歧义。

备选方案：
- 立刻删除看起来不用的工具目录。
- 未采用，因为实际使用情况尚不完全明确，直接删除比先补治理规则风险更高。

### Decision 4: 非琐碎的文档和 Prompt 治理变更必须使用 OpenSpec

后续如果要调整文档结构、Prompt 真理源规则、分发脚本或工具目录清理策略，只要影响面不是局部小修，就应该建立 OpenSpec change。

理由：
- 这些变更会影响团队工作流，需要明确的 proposal、design 和任务追踪。
- OpenSpec 可以先记录治理决策的原因，再把稳定结论沉淀到长期文档中。

备选方案：
- 继续用临时 README 修改管理治理规则。
- 未采用，因为当前混乱本身就是多个入口缺少管理、逐步漂移造成的。

## Risks / Trade-offs

- 真理源规则不会立即更新所有现有镜像 -> 缓解方式：明确标注镜像是兼容层，并为分发或清理建立后续变更。
- 贡献者仍可能直接修改工具专属文件 -> 缓解方式：README、CONTRIBUTING 和 AI 指令都回指治理文档。
- OpenSpec 会给小型文档修改增加流程成本 -> 缓解方式：只有非琐碎或跨工具变更才要求 OpenSpec；错别字和局部澄清仍可直接修改。
- 治理文档本身也可能过期 -> 缓解方式：将其纳入 `docs-prompts-governance` capability，并保留失效引用检查任务。
