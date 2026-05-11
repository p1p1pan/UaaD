## ADDED Requirements

### Requirement: 文档真理源

仓库 MUST 为长期项目文档定义稳定的真理源位置。

#### Scenario: 贡献者需要项目资料
- **WHEN** 贡献者需要需求、架构、数据库、协作、运行或测试信息
- **THEN** 贡献者可以识别 `docs/` 或明确列出的项目级规范文件为权威位置

#### Scenario: 文档入口引用源文件
- **WHEN** README 或贡献指南引用某个文档源文件
- **THEN** 被引用文件必须存在于仓库中

### Requirement: AI 资产真理源

仓库 MUST 为团队维护的 AI Prompt、Workflow、Skill 和可复用指南定义稳定的真理源位置。

#### Scenario: 贡献者修改共享 AI 指南
- **WHEN** 贡献者修改适用于多个工具的共享 AI 行为
- **THEN** 贡献者必须先更新 `.agents/` 或另一个已记录的真理源位置，再修改工具专属镜像

#### Scenario: 工具专属资产存在
- **WHEN** Prompt、Workflow、Command 或 Skill 存在于工具专属目录下
- **THEN** 仓库治理规则必须说明它是权威源，还是兼容/分发产物

### Requirement: Prompt 更新顺序

仓库 MUST 记录 Prompt 和 Workflow 变更的必要更新顺序。

#### Scenario: Prompt 变更影响多个工具
- **WHEN** Prompt 或 Workflow 变更影响多个 AI 工具
- **THEN** 必须先更新真理源文件，再更新兼容副本

#### Scenario: 兼容镜像无法立即更新
- **WHEN** 某个兼容镜像无法在同一变更中更新
- **THEN** 变更必须记录该镜像被有意延后处理，而不是保持含糊状态

### Requirement: 跨领域变更使用 OpenSpec 治理

仓库 MUST 使用 OpenSpec 管理非琐碎、跨领域的文档结构或 Prompt 治理变更。

#### Scenario: 变更影响文档和 AI 入口
- **WHEN** 某个变更影响多个文档入口或 AI 入口
- **THEN** OpenSpec change 必须记录 proposal、design、tasks 和相关 capability requirements

#### Scenario: 变更只是错别字或局部澄清
- **WHEN** 文档或 Prompt 变更仅限于错别字或局部澄清
- **THEN** 该变更不需要新建 OpenSpec proposal

### Requirement: 防止失效引用

仓库 MUST 防止主入口把贡献者或 Agent 引导到不存在的文件。

#### Scenario: 主 AI 指令列出必读文件
- **WHEN** 主 AI 指令文件列出必读文档
- **THEN** 每个列出的文件必须存在，并符合当前仓库文档布局

#### Scenario: 治理变更进入完成检查
- **WHEN** 治理相关变更准备完成
- **THEN** 该变更必须包含对主入口失效文件引用的检查
