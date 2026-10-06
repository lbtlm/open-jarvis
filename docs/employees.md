# 专业岗位卡 / Specialist employee cards

Jarvis 的主控负责决定是否派发、检查授权、监督执行和最终验收。[Agency Agents](https://github.com/msitarzewski/agency-agents) 是专业岗位模板的参考来源，不是自动安装、自动注册或自动雇佣的完整框架。岗位卡是可读 Markdown；它描述专业职责、范围、边界、技能路径和验收，不能替代本次任务合同中的模型、思考强度、Fast、权限或副作用范围。该轻量流程不安装独立应用或完整框架，仅增加静态卡片查询和派发预览，不引入管理服务或数据库。

## 统一入口

普通任务请求、`ask-matt` 等技能入口、恢复任务和用户明确要求的新任务，都先经过同一套 Jarvis 分流。技能决定工作方法，主控决定岗位与模型、监督和验收。已有派发合同的执行者直接履约，不再成为第二个主控。

普通问答和单步查询留在主控 Direct；代码微改也交给合适员工，用户明确要求直改时例外。非代码微编辑保持与影响相称的验收。员工专业能力先于本次难度、模型、思考强度和 Fast：先检查岗位是否符合任务领域、交付物、语言、方法/工具和权限要求，再在匹配的已批准岗位中考虑复用；没有匹配岗位就提出临时雇佣建议。派发说明用一句话给出能力匹配依据与关键缺口。曾获批准、处于空闲或固定模型档位均不证明专业适配。已有范围内的批准不重复询问，沉淀岗位和技能仍单独由用户决定。

按实际影响和风险选择微改 `micro`、小改 `light`/`simple`、常规中改 `standard` 或大改 `complex`，不按行数判断。默认一位员工完成调查、实施和验证，不强制 Luna 扫描或查文件、读文档、实施接力，不新增台账、评分或固定复核。每次实现同时复用、合并相关重复、原位修改、清理替代旧逻辑和必要新增；相关旧冗余可在范围内一起处理，不全仓库顺手重构，行为验证优先于净减行数。主控验收复用证据、必要新增和替代清理。CLI 本次设置与运行时绑定见[分流说明](routing.md#task-local-plan-settings-v015)。

例如，后端员工可以为文档核对 CLI 行为，但后端经历不能证明中英日编辑能力。三语说明应匹配覆盖对应语言、术语、语义一致性和语言质量的岗位；不能为避免新雇佣而把旧后端实例改名为翻译。新岗位可以在明确待验证能力和验收方法后获批试用，不要求先虚构历史经验。员工卡适合复用，也不意味着必须复用已有运行实例。

通常使用当前任务的子代理；用户明确要求独立任务时，该任务可直接承载获批员工。两种方式都必须展示同样的派发信息，但独立任务不会自动套用 `jarvis_terra` 等子代理配置。设置无法绑定时说明阻塞，不能悄悄用主控 Astra 顶替。

每位员工及子代理（含 Reviewer）统一展示为 **员工名 · 职位｜主题**，例如 `Atlas · 后端工程师｜导入诊断`，用于派发、实质进展、交接、提交和主控验收。姓名和职位随获批岗位保持稳定，主题描述本次具体工作，语言跟随用户。确有需要且含义已核实时附 `Issue #449`、`v5.1.5` 等标识，不使用含义不明的裸数字。头像/icon 可选，不要求新增图片、安装依赖或岗位字段，也不能凭客户端图标判断员工身份。

同一员工可有多个实例；显示名称、真实运行 ID、内部执行档位及请求/核验设置分别记录。受工具字符限制的 `task_name` 使用 `atlas_backend_import_diagnosis_01` 等合法标识，与展示名称建立映射。工具支持标题时使用上述格式，否则在对话中展示；不保证客户端标签、头像或旧代理改名。使用“常规”等可读档位，`jarvis_terra` 等兼容标识仅放技术映射详情。完整细则见[员工命名](../payload/skills/jarvis-orchestrator/references/employees.md#employee-names-and-runtime-identity)。

可见派发记录只需一行：**员工名 · 职位｜主题 — 任务档位 · 范围与验收 · Skills · 模型/强度/Fast · 子代理或独立任务 · 验收主控**。派发后补真实 ID 与设置核验状态，交付时报告实际使用的技能、结果和证据。最多三个同时执行的员工按主控管理的两种派发方式合计；全局子代理上限并不自动限制独立用户任务。

这些是可审计的工作约定，尚无强制拦截所有 Codex 工具调用的运行时机制。安装检查证明文件一致，不能证明每次对话都已正确执行；真实派发记录才是验收依据。

## 流程 / Flow

1. 先用领域和关键词查询已有岗位卡。候选数没有固定上限；用户决定实际并发，最多同时三个子代理（含 Reviewer、不含主控），并服从更低的 Codex 有效上限。
2. 新岗位建议必须给出姓名、职责、文件或功能范围、验收、适用技能路径，以及本次模型、思考强度、Fast 和选择原因。用户批准后，主控才按已加载角色或能保留实际配置的显式兼容路径派发。
3. 岗位卡不等同于原生 `agent_type`，也不能宣称运行时已热加载。若原生角色不可用，只有能保留实际模型、思考强度、Fast、sandbox、权限和所需技能约束的兼容路径才可使用；否则交回主控。
4. 新任务不会自动新增永久员工。旧实例只能在同专业、同项目相关上下文中复用；已批准的范围内无需重复询问。
5. 收尾时只有产生新价值才询问保存员工、保存技能、两者或都不保存。保存岗位卡必须获得用户批准：项目保存到 `.jarvis/employees/<id>.md`，只有用户明确个人复用时才保存到 `CODEX_HOME/jarvis/employees/<id>.md`。

## 技能 / Skills

用户明确指定的适用技能优先，然后选已有技能；员工卡不是技能白名单。需要外部技能时，使用 [Vercel Skills CLI](https://github.com/vercel-labs/skills) 先搜索和预览：

```sh
npx skills find "query"
npx skills add owner/repo --list
```

用户批准具体技能后，默认安装到项目：

```sh
npx skills add owner/repo --skill skill-name --agent codex
```

只有用户明确要求个人复用时才添加 `--global`。安装技能包不自动雇佣、注册或保存岗位。不得用命令参数代替具体用户批准；已有有效批准无需重复确认。

Jarvis 自身要求 Node.js 22+，不因本流程新增运行时依赖。Vercel Skills CLI 是可选外部命令，可能有更高的独立 Node.js 要求；请使用满足其要求的运行时，不要为了搜索或安装技能擅自升级全局 Node.js。

## Example

示例岗位卡见 [Iris 前端工程师](../payload/skills/jarvis-orchestrator/references/employee-card.md)。它是待选的 Markdown 模板，不代表 Iris 已获批准、已保存或已注册。上游角色内容如需导入，应记录具体源文件、commit/version 和许可证。

---

Jarvis keeps the controller responsible for dispatch, authorization checks, supervision, and final acceptance. [Agency Agents](https://github.com/msitarzewski/agency-agents) is a reference source for specialist templates, not a full framework that installs, registers, or hires anyone automatically. A card is readable Markdown: it records specialist responsibility, scope, boundaries, skill paths, and acceptance. The task contract separately carries the current model, effort, Fast, permissions, and side-effect limits. This lean flow installs no standalone app or full framework and adds only card search and assignment preview, without a management service or database.

Ordinary Q&A and single-step lookups stay Direct. Assign code changes, including micro-edits, to a suitable employee unless the user explicitly requests a direct edit; keep non-code micro-edit acceptance proportionate. Establish capability fit for the domain, deliverable, languages, methods/tools and permissions before preferring an existing approved employee. Difficulty, model, effort and Fast are settings for this assignment. State one concrete fit reason and any material gap. Approval, idle status and model strength do not establish a missing specialty. For example, backend expertise alone is not evidence of Chinese/English/Japanese editing ability; propose a task-scoped language specialist when no suitable employee exists. New candidates may be approved with explicit unverified abilities and meaningful acceptance checks, without invented prior experience. Card reuse and runtime-instance reuse are separate decisions. Candidate counts are uncapped, while the user chooses actual concurrency up to three simultaneous subagents including Reviewer and excluding the controller, subject to a lower effective Codex limit. A proposal must state the employee name, responsibility, owned scope, acceptance, applicable skill paths, current model, effort, Fast setting, and rationale. It requires approval before dispatch.

Every employee/subagent, including Reviewer, uses `Employee name · Profession | Topic` in dispatch, substantive progress, handoff, submission and controller acceptance; for example `Orion · Architect | Module boundaries`. Keep the approved name and profession stable, use the user's language, and make the topic specific to the assignment. Include identifiers only when useful and their meaning is verified, such as `Issue #449` or `v5.1.5`, rather than ambiguous bare numbers. Avatars/icons are optional and require no new asset, dependency or card field; client icons do not establish employee identity.

Multiple instances may share an employee name: record the real runtime ID, internal execution profile and requested/verified settings separately. For constrained tool identifiers, use a valid task name such as `atlas_backend_import_diagnosis_01` and map it to the display label. Use the label as a title where supported; otherwise show it in conversation without promising client labels, avatars or existing-agent renaming. Use readable lanes such as Standard and keep compatibility keys such as `jarvis_terra` in technical mapping details. See the authoritative [naming rules](../payload/skills/jarvis-orchestrator/references/employees.md#employee-names-and-runtime-identity).

An employee card is not a native `agent_type` and cannot claim hot reload. A compatibility path is allowed only when it preserves the actual model, effort, Fast, sandbox, permissions, and required skill constraints; otherwise return the decision to the controller. New tasks do not create permanent employees automatically. Reuse a completed instance only for relevant same-specialty, same-project context. Save a card only after user approval: `.jarvis/employees/<id>.md` for the project, or `CODEX_HOME/jarvis/employees/<id>.md` only for explicitly requested personal reuse. Ask whether to save the employee, skill, both, or neither only when closeout created new value.

Prefer existing skills. Without approval for a specific external option, search and preview only with `npx skills find "query"` and `npx skills add owner/repo --list`. After approval, install a single project skill with `npx skills add owner/repo --skill skill-name --agent codex`; add `--global` only for explicitly requested personal reuse. No command parameter substitutes for concrete user approval, and an approval that remains valid does not need to be requested again. Installing a package never hires, registers, or saves an employee.

Jarvis requires Node.js 22+ and adds no runtime dependency for this flow. Vercel Skills CLI is an optional external command and may require a higher Node.js version of its own. Use a runtime that satisfies the command's requirement; do not upgrade global Node.js merely to search for or install a skill.

See the [English guide](../README.md) / [中文指南](../README.zh-CN.md). Starter card JSON frontmatter enables profession and keyword search; the body keeps proposed abilities, verified experience and limitations distinct.

Choose micro, light/simple, standard or complex by actual impact and risk, not lines of code. One suitable employee normally completes investigation, implementation and verification, without a mandatory Luna scan or a file-search/document-reading/implementation relay. No new ledger, scoring or routine review is required. Each implementation reuses suitable code, consolidates related duplication, edits in place, removes superseded logic and adds only what is needed. Clean up related obsolete code within scope; avoid repository-wide refactoring and preserve behavior verification over line-count reductions. The controller checks reuse evidence, necessary additions and replacement cleanup. See [task-local settings and runtime binding](routing.md#task-local-plan-settings-v015).

## 通用模板与沉淀

安装默认不选员工模板；通过 `--starter development|writing|office|video|none` 按需选择。`employees --init` 不带 starter 仍保留旧版开发模板行为。模板只添加候选卡，不雇佣员工或安装技能。用户私有专用员工保持原样。

新增资产的候选、验证、用户决定、保存及复用见[资产自进化](asset-evolution.md)。
