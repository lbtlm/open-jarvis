# Codex Jarvis

[English](README.en.md) · [MIT](LICENSE)

为 Codex Desktop 和 CLI 提供一套可审计的多代理协作安装器。Astra / High 是首次安装的推荐主控；用户选择的主控模型、思考强度和 Fast 设置才实际控制工作流。Luna、Terra、Sol 是任务路由的逻辑分工，模型与档位同样由用户选择；安装器只给出推荐。

该包目前为 `0.1.0`，尚未声明任何 npm 发布或 GitHub 托管地址。公开发布后，安装命令将是：

```sh
npx codex-jarvis install
```

需要 Node.js 22 或更新版本，以及已登录、支持独立子代理角色配置的新版 Codex。安装目标按 `--home`、`CODEX_HOME`、`~/.codex` 的顺序选择；桌面端和 CLI 使用同一个 Codex home 时，只需安装一次。

安装后，在新的 Codex 任务中可以这样发起协作：

> 按 Jarvis 流程完成这个开发任务。由主代理定义验收、选择执行角色、监督进度并最终验收；派发时记录真实模型、档位和代理 ID。

发布前请在克隆仓库中运行：

```sh
npm ci
node bin/codex-jarvis.mjs audit --home /path/to/codex-home
```

也可以先打包，再以本地 tarball 验证 `npx`：

```sh
npm pack
npx --package ./codex-jarvis-0.1.0.tgz codex-jarvis audit --home /path/to/codex-home
```

## 命令

```text
npx codex-jarvis [install|audit|doctor|rollback]
  [--home PATH]
  [--controller-effort EFFORT]
  [--fast on|off]
  [--interactive|--yes]
  [--models FILE]
  [--previous-manifest PATH ...]
  [--manifest PATH]
  [--json]
```

不带参数只显示帮助。`audit` 和 `doctor` 只读；`install` 会备份并记录哈希；`rollback` 必须指定 `--manifest`。`install` 会修改所选 `CODEX_HOME` 的共享用户设置，开发和验收时应使用合成 home；`audit` 不写入。安装器只升级它自己已管理的 v2 状态，不会迁移旧式 Codex 配置语法（例如 `agents.max_threads` 或角色表）。若要接管旧 Python v1 Jarvis 安装器留下的状态，必须为每一份旧状态重复传入 `--previous-manifest`，顺序从最旧到最新。先针对明确的 `--home` 运行审计。`doctor` 只检查已安装文件的静态状态，不会探测运行中的 Codex、模型访问或实际角色派发。

`install` 在终端中默认逐角色询问模型、思考强度和 Fast；`--interactive` 强制询问，适合管道化脚本测试；`--yes` 跳过询问并使用现有、显式 JSON 或推荐设置。没有 TTY 且未传 `--yes` 时会拒绝安装。写入前会展示预览并要求最终确认，取消时不写入。再次安装会读取现有 v2 设置供修改，不会盲目重置。

`--models` 接受 JSON 文件，允许为 `controller`、`luna`、`terra`、`sol`、`reviewer` 分别提供 `{ "model": "…", "effort": "…", "fast": false }` 覆盖。`--fast on|off` 是主控 Fast 的简写；其他角色在向导或 JSON 中单独选择。派发前由编排技能读取已安装角色 TOML 的模型、档位和 Fast 值；兼容显式绑定使用这些实际值，不以逻辑路由标签替换它们。

## 工作流与兼容性

默认分工：

| 角色 | 模型 / 档位 | 触发条件 |
| --- | --- | --- |
| 主控 | Astra / High，均为推荐 | 拆解、调度、监督、收回成果、最终验收 |
| Luna | Luna / Medium，均为推荐 | 位置、做法和验收明确的低风险小任务 |
| Terra | Terra / Medium，均为推荐 | 边界稳定的常规开发、定位与修复 |
| Sol | Sol / High，均为推荐 | 跨模块契约、并发、权限、迁移等复杂或高风险任务 |
| Reviewer | Sol / High，均为推荐 | 按需独立复核，要求有效只读沙箱 |

可复制 [模型配置示例](docs/models.example.json)，保留需要覆盖的角色后使用：

```sh
node bin/codex-jarvis.mjs audit --models ./my-models.json
node bin/codex-jarvis.mjs install --models ./my-models.json
```

Fast 默认关闭以节省额度；若运行时支持，开启时会使用 `service_tier = "fast"` 和 `features.fast_mode = true`，关闭时设置 `service_tier = "default"`，不会禁用运行时的 Fast 功能开关。Fast 会消耗更多额度，模型和 Fast 是否可用由账户和 Codex 运行时决定；不预设 Spark 当前可用。

默认执行角色为 Luna/Medium、Terra/Medium、Sol/High；独立复核者使用 Sol/High 并需要可验证的只读沙箱。若运行时没有原生注册角色，工作流允许以兼容显式绑定方式使用受支持的通用 worker：读取角色 TOML 的指令，再明确传入模型和推理档位。记录中必须区分“请求的设置”和“运行时已验证的设置”。

这不能模拟缺失的安全能力。即使已加载原生 reviewer 角色，也要独立验证其生效的只读 sandbox，因为运行中的父级设置可能覆盖它。本包面向支持独立角色配置的现代 Codex Desktop 和 CLI；不同运行时的角色可见性和模型可用性并不保证一致。重启或重新打开 Codex 后，使用一次实际派发进行验证。

路由、交接、门禁与工作单格式见 [路由说明](docs/routing.md) 和 [兼容性说明](docs/compatibility.md)。详细发布步骤见 [发布说明](docs/releasing.md)。

可以使用真实 Codex 可执行文件进行无模型请求的运行时兼容检查：

```sh
npm run test:runtime -- --codex-bin /path/to/codex
```

该检查在临时 Codex home 中安装配置，再回读运行时设置，不发起模型请求；`--codex-bin` 必须是实际可执行文件，不能是 `.cmd` 包装器。

## 范围与安全

协作规则是工作约定，实际权限仍由 Codex 运行时和用户授权控制。专用员工或技能保留其自身的权限和副作用边界；不要通过通用 worker 绕过这些边界。请勿在 issue、日志或清单中提交 Codex home、备份、凭据或会话数据。

该项目按 MIT 许可证提供。提交方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 参考

- [Codex subagents configuration](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Codex config reference](https://learn.chatgpt.com/docs/config-file/config-reference)
- [npm npx documentation](https://docs.npmjs.com/cli/v11/commands/npx)
