## Why

UAAD 已经有不少有价值的项目文档和 AI 协作资产，但同一类规则分散在 `docs/`、`.agents/`、`.github/`、OpenSpec 以及多个工具专属目录中。如果没有明确的治理模型，贡献者和 AI Agent 很容易改错副本、沿用过期引用，或者继续新增重复的 Prompt 来源。

本变更用 OpenSpec 固化文档和 Prompt 资产的管理规则，明确哪些文件是单一真理源，以及变更应该如何从源头同步到适配层。

## What Changes

- 定义仓库级的“文档与 Prompt 治理”能力。
- 明确 `docs/` 是项目文档真理源。
- 明确 `.agents/` 是团队维护的 AI Workflow / Skill 真理源。
- 默认将 `.github/prompts/`、`.github/skills/` 以及其他工具专属目录视为兼容层或分发副本，除非后续变更明确提升其地位。
- 要求文档和 Prompt 变更先修改真理源，再同步工具专属镜像。
- 修正 README、CONTRIBUTING、Copilot instructions、SDD workflow 等主入口，使其引用真实存在的源文档。
- 记录后续可以继续推进的清理和分发自动化方向，但本变更不删除兼容目录。

## Capabilities

### New Capabilities

- `docs-prompts-governance`：管理项目文档与 AI Prompt / Workflow 资产的真理源归属、更新顺序和验收要求。

### Modified Capabilities

- 无。

## Impact

- 影响的项目文档：`README.md`、`CONTRIBUTING.md`、`docs/DOCS_PROMPTS_GOVERNANCE.md`。
- 影响的 AI 指令：`.github/copilot-instructions.md`、`.agents/workflows/sdd-standard.md`。
- 影响的 OpenSpec 资产：新增 `openspec/changes/govern-docs-prompts/` 下的 proposal、design、tasks 和 capability spec。
- 不涉及应用运行代码、API、数据库结构或前端行为变更。
