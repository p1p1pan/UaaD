# 全局指令：UAAD 项目规范驱动开发 (SDD)

# 如果你是一个运行在本目录的 AI Agent (例如 Cursor, Copilot 等)，请在遵循以下规则的前提下协助代码开发。

## 1. 必读上下文 (Mandatory Readings)

在开始任何跨文件的重构或业务逻辑开发之前，请静默读取并分析以下文件：

- `docs/SRS.md`：获取业务上下文字段。
- `docs/SYSTEM_DESIGN.md`：获取系统架构、API 契约与关键数据流。
- `docs/DDL.md`：获取数据库结构与字段约束。
- `.agents/workflows/sdd-standard.md`：阅读全局规范。
在充分理解上述文档前，请勿直接开始编写 `Entity`, `Model`, 或 `Controller` 代码。

## 2. 严格遵守需求说明 (Strict Adherence to Specifications)

- 如果被要求实现一个功能，但该功能在 `SRS.md` 中不存在，请明确指出这一点，并说明依据 SDD 方法论，需要人类工程师先行在 SRS 中补齐需求。

## 3. 测试驱动开发 (Test-Driven Development)

- 在完成并发、超卖防护等关键业务代码块的生成后，请务必生成相应的自动化测试用例（使用 Go Test 框架）。
- 确保测试用例能够成功运行并覆盖核心逻辑。

## 4. 履历留痕与校验 (Operation Logging and Walkthroughs)

- 对于任何超过 50 行的显著逻辑变更，请在完成后于 `docs/walkthrough.md` 中生成一段涵盖主要变更和 Diff 思路的简要记录。

## 5. Prompt 维护约定

- 团队通用 AI 规则优先维护在 `.agents/` 下，不要把同一条规则复制到多个工具目录分别演化。
- `.github/copilot-instructions.md` 应保持入口性质，尽量通过引用项目真理源来约束行为。
- 仓库内文档与提示词的治理说明见 `docs/DOCS_PROMPTS_GOVERNANCE.md`。

