# UAAD 项目入口

> 根 `README.md` 只保留项目入口和最短路径导航。
> 详细文档索引统一收口到 [docs/README.md](docs/README.md)，避免在多个入口重复维护同一份说明。

**最后更新：2026-04-21**

---

## 快速上手

按顺序阅读：

1. [docs/SRS.md](docs/SRS.md)
2. [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md)
3. [docs/COLLABORATION.md](docs/COLLABORATION.md)
4. [docs/README.md](docs/README.md)
5. [CONTRIBUTING.md](CONTRIBUTING.md)
6. [frontend/FRONTEND_SPEC.md](frontend/FRONTEND_SPEC.md)

---

## 文档入口

- 统一文档中心： [docs/README.md](docs/README.md)
- 文档与 Prompt 治理： [docs/DOCS_PROMPTS_GOVERNANCE.md](docs/DOCS_PROMPTS_GOVERNANCE.md)
- OpenSpec 使用要求： [docs/README.md §5](docs/README.md#5-openspec-变更)

---

## 开发入口

- 后端任务： [backend/task.md](backend/task.md)
- 前端任务： [frontend/task.md](frontend/task.md)
- 本地运行： [docs/RUN_GUIDE.md](docs/RUN_GUIDE.md)
- 联调记录： [docs/walkthrough.md](docs/walkthrough.md)
- 压测说明： [docs/STRESS_TEST.md](docs/STRESS_TEST.md)

---

## 代码结构

```text
backend/   Go 后端、迁移、测试与脚本
frontend/  React 前端工程
docs/      长期项目文档与操作手册
openspec/  变更提案、设计、任务与 capability spec
.agents/   团队维护的 AI workflow / skill 真理源
```

---

## 维护约定

- 根 `README.md` 不再维护超长文档清单
- 详细导航统一维护在 [docs/README.md](docs/README.md)
- 长期稳定结论优先写入 `docs/`
- 非琐碎跨模块变更优先进入 `openspec/changes/<change>/`
