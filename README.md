[中文](README.md) · [English](README.en.md) · [日本語](README.ja.md)

# Open Jarvis

Open Jarvis 为 Codex Desktop 和 CLI 提供由主控监督的员工协作与资产复用流程。
它适用于开发、写作、办公、视频等任务：主控定义验收、选择合适的专业员工、监督执行并最终验收。
员工的专业身份与任务的模型档位分开，用户选择的模型、思考强度和 Fast 设置始终优先。

当前为 **0.1.0 预览版**，尚无 GitHub Release。发行通过 GitHub Release，不发布到 npm。GitHub 仓库：[lbtlm/open-jarvis](https://github.com/lbtlm/open-jarvis)。
三语 README 介绍同一套功能；CLI 和全部参考文档尚未完成本地化。
本项目不承诺官方认证、模型费率比较、额度收益或固定节省比例。

## 安装与开始使用

需要 Node.js **22+**（提供 npm/npx），以及已登录、支持独立子代理角色配置的 Codex。
安装目标依次取 `--home`、`CODEX_HOME`、`~/.codex`。
Desktop 和 CLI 共用一个 Codex home 时只需安装一次。

当前请将审阅过的本地安装包放在终端当前目录，然后运行：

```sh
npx --package ./open-jarvis-0.1.0.tgz open-jarvis install
```

终端向导让你选择主控与执行角色的模型、思考强度、Fast，以及员工模板。
模板默认是 `none`，可以先安装协作规则，再按实际任务选择员工。
`--yes` 使用非交互安装并保留已有偏好；全新安装推荐 Astra / High。
Fast 独立设置，默认关闭，不会自动开启 Ultra 或将用户主控改为 Sol。

GitHub Release 发布并包含对应安装包后，才可直接使用远程安装命令：

```sh
npx --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.0/open-jarvis-0.1.0.tgz open-jarvis install
```

下文统一使用本地包前缀：现在使用审阅过的候选包；Release 发布后，也可先下载对应安装包到当前目录。
示例以 0.1.0 为例，使用其他版本时请同步替换 URL、文件名和版本号。
无需克隆源码、全局安装 Jarvis 或手动运行 Node 脚本。

安装后打开新的 Codex 任务，例如：

> 按 Jarvis 流程完成这个任务。主控定义验收，按能力选择员工，监督执行并最终验收；记录真实代理 ID 和运行时设置证据。

新会话有助于加载配置，但不保证原生角色已经生效；实际派发仍需核验。
安装前可以先用 `audit` 预览变更。安装后的静态检查使用 `doctor`。

## pnpm 可选入口

npx 是默认入口。已有 pnpm 的用户可以选择同一个包和安装向导：

```sh
pnpm --package=./open-jarvis-0.1.0.tgz dlx open-jarvis install
```

GitHub Release 发布后也可直接使用远程包：

```sh
pnpm --package=https://github.com/lbtlm/open-jarvis/releases/download/v0.1.0/open-jarvis-0.1.0.tgz dlx open-jarvis install
```

后续本地包示例可将 `npx --package ./open-jarvis-0.1.0.tgz open-jarvis`
换为 `pnpm --package=./open-jarvis-0.1.0.tgz dlx open-jarvis`，并保留命令及参数。
两者共用 Codex home、员工和资产，不必安装两遍或建立第二套资产库。
pnpm **10.18.1** 已在 Windows 本地实测；支持范围见[兼容性说明（英文）](docs/compatibility.md)。

## 常用命令

| 命令 | 用途 | 示例（本地包入口） |
| --- | --- | --- |
| `audit` | 只读预览安装变更 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis audit` |
| `install` | 安装或升级，并保护备份 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis install --starter none` |
| `doctor` | 静态检查已安装文件 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis doctor` |
| `rollback` | 按清单恢复一次安装 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis rollback --manifest /path/to/manifest.json` |
| `employees` | 检索员工卡或预览模板初始化 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis employees --query writing` |
| `plan` | 预览员工、技能及执行档位 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis plan --employee nova-writer --difficulty standard` |
| `export` | 写入新的资产归档 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis export --out ./my-assets.jarvis.json.gz` |
| `import` | 预览资产归档，确认后导入 | `npx --package ./open-jarvis-0.1.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz` |

`/path/to/manifest.json` 是占位路径，请换成实际安装清单。
`--home PATH` 选择 Codex home；`--project PATH` 显式选择项目资产；`--json` 输出机器可读结果。
完整参数可通过 `npx --package ./open-jarvis-0.1.0.tgz open-jarvis --help` 查看。
`audit` 和 `doctor` 不发起实时模型请求，也不证明员工已运行。

## 主控、专业员工与模型

普通问答、单步查询和微小可验证修改由主控直接处理。
其他任务先判断所需领域、交付物、语言以及方法和工具，再在能力匹配的已批准员工中优先复用。
批准状态、空闲状态或固定模型都不能证明专业能力。
缺少匹配岗位时，主控提出临时新员工，说明职责、技能与设置，获用户批准后派发。
不会强行复用无关员工，也不会通过改名宣称已有能力。

| 执行档位 | 推荐模型 / 思考强度 | 适用任务 |
| --- | --- | --- |
| `controller`（主控） | GPT-6 Astra / High | 调度、监督与最终验收 |
| `luna` | GPT-6 Luna / Medium | 明确且低风险的小任务 |
| `simple` | GPT-6.1 Sol / Low | 已知机制的简单实现 |
| `terra` | GPT-6.1 Sol / Medium | 常规任务及范围内未知故障探索 |
| `sol` | GPT-6.1 Sol / High | 契约变化、复杂语义或关键行为 |
| `reviewer` | GPT-6.1 Sol / High | 风险或证据触发的独立复核 |

这些是推荐设置，已有用户选择优先。`terra` 是兼容键，不代表 GPT-6 Terra 产品。
Fast 与模型和思考强度分开选择；可用模型、权限和服务设置需在实际运行时核验。
默认一个执行者；同时运行的子代理最多三个，包含 Reviewer、不含主控，并服从更低的用户或全局限额。
执行者不递归委派。独立复核由明确风险或证据触发，并非每个任务都安排。
无法保留必要模型、Fast 或 Reviewer 只读权限时，应报告该派发阻塞。

## 员工与技能

| 模板 | 候选员工 |
| --- | --- |
| `none` | 不添加员工卡 |
| `development` | Iris（前端）、Atlas（后端）、Quinn（QA）、Sentry（复核） |
| `writing` | Nova（写作） |
| `office` | Clara（办公） |
| `video` | Frame（视频） |

模板只是候选卡，不等于已雇佣、已加载技能或有经验证明。
旧命令 `employees --init --yes` 仍兼容，默认添加缺失的开发模板卡。
例如，预览写作候选卡后再明确写入：

```sh
npx --package ./open-jarvis-0.1.0.tgz open-jarvis employees --init --starter writing
npx --package ./open-jarvis-0.1.0.tgz open-jarvis employees --init --starter writing --yes
npx --package ./open-jarvis-0.1.0.tgz open-jarvis plan --employee nova-writer --difficulty standard --skill my-writing-skill
```

`my-writing-skill` 是占位技能 ID，必须换为实际存在的技能；缺失时计划会报告阻塞。
`plan` 不派发员工、不读取技能正文，也不能证明技能已加载。
技能选择先遵循用户显式指定，再找已安装的匹配技能，仍缺少时才按需搜索外部技能。
员工卡的技能建议不是白名单；`--skill` 可临时绑定卡外技能，不会永久改卡。
安装 Jarvis 不会全库安装技能，也不会赋予 Office、剪辑、插件或云账号能力。
员工卡是文件资产，不是常驻进程。详见[员工约定（英文）](payload/skills/jarvis-orchestrator/references/employees.md)。

## 资产自进化与迁移

可复用成果按“形成候选 → 验证 → 用户决定 → 保存或更新 → 后续复用”积累。
可以保留员工经验、技能、知识、偏好和模板素材；经验须有实际证据和适用条件。
任务批准或临时雇佣不等于永久保存批准；不会自动训练模型或改写长期指令。
无需每次强制评分、复盘或统计。详见[资产自进化（中文）](docs/asset-evolution.md)。

个人资产位于 Codex home 的 `jarvis/`，项目资产位于 `.jarvis/`。
导出包括员工、知识、偏好、resources、选中技能目录和模型偏好。
`jarvis/skills.json` 显式登记支持技能依赖；不会自动扫描所有技能、插件或解析全部正文依赖。
默认技能根目录依次是项目 `.agents/skills`、项目 `.codex/skills`、home `skills`、home 同级 `.agents/skills`。
重复的 `--skill-root PATH` 完整替换默认导出根目录列表。

```sh
npx --package ./open-jarvis-0.1.0.tgz open-jarvis export --out ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.1.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz
npx --package ./open-jarvis-0.1.0.tgz open-jarvis import --from ./my-assets.jarvis.json.gz --yes
npx --package ./open-jarvis-0.1.0.tgz open-jarvis install --models /path/to/codex-home/jarvis/models.json --yes
```

有项目资产时，源机器的导出和目标机器的导入都需显式添加 `--project`，使用各自项目路径。
导入先预览，`--yes` 才写入；相同内容跳过，任何内容差异使整批停止，不覆盖或执行脚本。
最后一条命令中的路径需替换；先审阅模型偏好，再明确安装激活，导入本身不会改变主控。
目标机器的登录、插件、外部工具与权限须另行恢复；资产中的绝对路径不会自动重写。
归档限额：单文件 **4 MiB**、总内容 **32 MiB**、压缩包 **16 MiB**、最多 **5000** 个文件。
视频等大媒体另行迁移。导出不自动脱敏正文，分享前请审阅；hash 校验是完整性检查，不是来源签名。
详见[资产执行约定（英文）](payload/skills/jarvis-orchestrator/references/assets.md)。

## 常见问题

**会改掉我的主控吗？** 已有模型、思考强度和 Fast 偏好会保留；新安装推荐 Astra / High。
显式使用 `--models` 前先审阅文件。专业岗位与模型档位不会自动替换用户主控。

**怎样确认安装生效？** 先运行 `audit` / `doctor`，再打开新任务并实际派发。
记录真实代理 ID 和运行时设置；配置文件存在或新会话开始都不保证原生角色注册、热加载或权限生效。

**没有适合的员工怎么办？** 提出符合领域、语言、交付物和工具需求的临时岗位，获批准后执行。
模板和岗位名不能代替能力证据；不把无关后端员工改名为语言专家。

**如何更新和回滚？** 先 `audit`，再 `install`；回滚使用该次安装清单的 `--manifest` 路径。
安装和回滚只管理自身配置，不删除用户员工或资产；后续修改冲突会拒绝回滚。备份可能敏感，请勿公开。

## 开发、发布与更新

功能开发使用分支，通过 PR 合入 `dev`；准备发行时，再创建 `dev` → `main` 的发布 PR。
合并到 `main` 即批准自动 CI/CD：通过工作流检查后生成版本标签和 GitHub Release 安装包，无需二次发布审批。
工作流失败时不能把该版本视为已发行；仓库合并记录与 Release 产物应分别核对。
包由 GitHub Release 托管，但安装依赖仍可能从 registry 获取，不保证完全离线。
发行规则见[发布流程（英文）](docs/releasing.md)，版本选择、更新与回滚见[升级说明（英文）](docs/upgrading.md)。

## 贡献与当前限制

维护者使用 npm 和 `package-lock.json`，不新增 pnpm 锁文件。相关开发检查为：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:package
pnpm run test:package:pnpm
```

Windows 本地 npm/pnpm 安装、迁移和回滚已验证；CI 配置覆盖 Windows、macOS、Linux 的 Node 22/24。
已配置的矩阵不等于所有平台已通过。独立资产代码复核因网络问题尚未完成，不宣称发布门禁全部通过。
静态检查不证明实时模型能力。详见[验证记录（英文）](docs/validation.md)与[发布流程（英文）](docs/releasing.md)。
贡献请阅读 [CONTRIBUTING（英文）](CONTRIBUTING.md)，安全问题见 [SECURITY（英文）](SECURITY.md)；许可为 [MIT](LICENSE)。
