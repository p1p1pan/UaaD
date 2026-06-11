## 1. 治理源文档

- [x] 1.1 新增 `docs/DOCS_PROMPTS_GOVERNANCE.md`，说明文档真理源、AI 资产真理源、兼容目录和更新顺序。
- [x] 1.2 更新 `README.md`，让新贡献者能找到文档与 Prompt 治理入口。
- [x] 1.3 更新 `CONTRIBUTING.md`，写明文档、Prompt、Workflow 变更必须先改真理源。

## 2. 主 AI 入口

- [x] 2.1 更新 `.github/copilot-instructions.md`，使其引用真实存在的文档文件和治理文档。
- [x] 2.2 更新 `.agents/workflows/sdd-standard.md`，使其引用现有的 SRS、系统设计、DDL 和 walkthrough 路径。
- [x] 2.3 确保主 AI 入口说明 `.agents/` 是团队维护的 AI Workflow 真理源。

## 3. OpenSpec 资产

- [x] 3.1 为治理变更新增 `proposal.md`。
- [x] 3.2 新增 `design.md`，说明真理源决策和非目标。
- [x] 3.3 新增 `specs/docs-prompts-governance/spec.md`，写入可验收的治理需求。
- [x] 3.4 新增任务清单，并保持它与已落地工作一致。

## 4. 验证

- [x] 4.1 运行 `openspec status --change govern-docs-prompts`，确认所有必需 artifact 都已存在。
- [x] 4.2 搜索主入口，确认没有 `docs/ER_Diagram.md` 或未限定路径的 `walkthrough.md` 等失效引用。
- [x] 4.3 检查 git diff，确认没有修改应用运行代码、API 契约或数据库结构。

## 5. 后续规划

- [x] 5.1 记录 Prompt 分发自动化和兼容目录清理的后续机会。
- [x] 5.2 将工具专属目录清理排除在本变更之外，除非后续有单独 OpenSpec change 授权。
