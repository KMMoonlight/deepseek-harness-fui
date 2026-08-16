# Agent Note: Plugin installation auto-approves pnpm's build-script allowlist

Status: implemented

[English](2026-08-16-plugin-install-auto-approves-builds.md) | 中文

## Problem

pnpm ≥11 会在以下情况硬失败：git 来源包的 prepare 脚本（`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`）或任一依赖的构建脚本（`ERR_PNPM_IGNORED_BUILDS`）不在 profile 的 `allowBuilds` 里。因此每个 git 分发的插件——以及每个带 node-pty 这类原生依赖的插件——无论走 CLI 还是[桌面安装器](2026-08-15-desktop-plugin-installation.md)都会失败，且只显示一行笼统的 `pnpm failed`。修复需要手工编辑 profile 的 `pnpm-workspace.yaml`，相当于把用户在提交安装时已经回答过的信任问题按包再问一遍：安装界面已声明插件会在本机执行代码、只应安装可信来源，提交动作本身就是信任决定。git 插件的 `allowBuilds` 键还内嵌解析后的 commit URL，每次更新都会让手工加的条目失效。

## Decision

`dsh plugin`（`apps/cli/src/plugin.ts`）改为捕获每次 pnpm 调用的输出（不再 `stdio: 'inherit'`），回显给调用方，并在失败时扫描输出中的白名单拦截：git prepare 错误里 `allowBuilds:` 示例块的键，以及 ignored-builds 错误里逗号分隔的 `name@version` 列表。解析到的键合并进 profile 的 `allowBuilds`，pnpm 自己写入 workspace 文件的待批准占位条目（`<name>: set this to true or false`，ignored-builds 失败时由 pnpm 写入）翻转为 `true`；用户显式设置的 `false` 绝不动。随后重试安装，至多三轮——git 插件通常需要两轮：先过 prepare 脚本，再过原生间接依赖。若某轮没有批准任何新键，则是真正的失败（解析、兼容性、网络），按原样透出 pnpm 的诊断。每次自动批准向 stderr 打印一行列出获批的键，让授权轨迹留在输出里。git 失败提示的正则现在也识别裸 `https://github.com/<owner>/<repo>` 地址。

## Alternatives considered

- **保留手工 `allowBuilds` 步骤**：否决，因为它把已尘埃落定的信任问题按包（且通过 commit 锁定的键，按更新）重复提问，而界面没有给出任何可操作的诊断。
- **在安装器 UI 里再次弹窗请求构建授权**：否决，因为它重复了提交动作已经表达过的授权——是一个只有一种合理答案的二次确认。
- **只写版本锁定键**：否决，改为同时翻转 pnpm 的仅包名占位条目，让 registry 原生依赖在版本升级后仍保有授权；git 键保留 pnpm 的 commit 锁定写法，因为 pnpm 就是那样报告的，更新时由重试直接批准新键。
- **保持 `stdio: 'inherit'`**：否决，因为扫描失败的输出必须先捕获；回显同时为终端和安装器的有界捕获保留了可观察的输出流。

## Consequences

- 安装 git 插件或带原生构建脚本的插件一次提交即可成功；只有硬失败（spec 无法解析、不兼容、网络）才会阻止安装。
- 被安装包树的构建脚本在用户安装时的信任下运行，只是由机器代劳而非手工——信任范围不变：恰好是这次提交的安装所拉入的内容。
- profile 的 `pnpm-workspace.yaml` 会累积 `allowBuilds` 条目，混合 commit 锁定的 git 键和仅包名的 registry 键；失效的旧条目无害。
- 插件更新导致 git commit URL 变化时，只会多走一轮自动批准，不再需要手工编辑。

## Testing

`apps/cli/tests/plugin.spec.ts` 用脚本化的假 pnpm 驱动 `runPlugin`，覆盖两种白名单错误形态加占位翻转、不触碰 `allowBuilds` 的真实失败透传，以及 `DSH_PNPM_ENTRY` 校验。开发期间还用内置 pnpm 11.7.0 入口对一个含 node-pty 依赖的 git 插件做过一次真实网络的端到端安装验证。
