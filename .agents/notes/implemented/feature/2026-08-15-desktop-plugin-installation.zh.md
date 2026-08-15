# Agent Note：桌面插件安装复用 profile 依赖对账

Status: implemented

[English](2026-08-15-desktop-plugin-installation.md) | 中文

## 问题

打包后的桌面运行时可以执行 `dsh plugin --profile fui add`，但要求用户打开终端，会让插件分发游离在桌面体验之外。若把通用进程启动器或包管理器直接暴露给 renderer，浏览器代码获得的权限又会超过安装所需范围。普通 Web 应用与桌面端共享 FUI bundle，也不能因此获得远程安装软件包的入口。

## 决策

`dsh-host-plugin-installer` 是仅限桌面端的一次安装变更 Host 适配器。其 Remote 方法接收一个包规格或 Git 规格，通过 `dsh-subprocess` 以 argv 数组调用现有 `dsh plugin --profile fui add -- <spec>` 命令。该适配器加载时要求 `DSH_DESKTOP=1`，并要求 CLI 入口是确实存在的绝对路径。除非桌面进程设置了该标记，否则 Web 应用 bundle 会禁用 Host 适配器及其 Client 设置贡献。

pnpm 和 profile manifest 共享可写状态，因此适配器会串行执行 profile 变更。创建进程前，它会拒绝空规格、类似选项的值、空白、控制字符和超长内容。子进程输出有大小限制，执行有截止时间，请求取消和 plugin 卸载都会终止受管进程树；结果通过稳定的业务失败码返回保留的诊断信息。subprocess provider 会移除环境中已有的 `DSH_*` 变量，因此适配器会明确转发打包的 `DSH_PNPM_ENTRY`。

`dsh-client-ui-settings-plugin-installer` 在“插件”设置下贡献“安装插件”页签。表单只在提交时调用 Remote；运行期间会禁用并发输入，卸载时取消请求，明确提示软件包会执行受信任代码，并展示成功、稳定失败和有界诊断。安装会提交 profile，但不会修改正在运行的 Cordis 图，因此成功后必须重启桌面应用。

## 验证

Host 测试固定 Remote 元数据、准确且不经过 shell 的 argv、打包 pnpm 转发、输入校验、串行执行、有界诊断、退出处理、超时、请求取消、卸载和桌面端加载限制。Client 测试验证贡献所有权、延迟调用、提交禁用、卸载取消、本地化成功与失败状态，以及可展开诊断。Host 与 Client 聚合 typecheck 和 build 均包含新包；组装后的桌面 FUI 验收则验证该页签只出现在桌面组合中。

## 考虑过的替代方案

- **让 renderer 直接运行 pnpm**：否决，因为这需要高权限 renderer bridge，还会重复 profile 命令已经负责的依赖和 patch-layer 规则。
- **在普通 Web profile 中暴露安装器**：否决，因为默认情况下，可远程访问的浏览器界面不应获得软件包安装权限。
- **立即加载新 bundle**：否决，因为热替换需要事务式依赖对账、Cordis 图卸载、回滚和 Session 语义。重启提供了清晰的激活点。
- **接受自由格式命令行**：否决，因为安装只需要一个不透明包参数，不需要 shell 解析或任意选项。

## 后果

- 桌面用户无需运行命令，即可从设置中安装通过 npm 或 Git 分发的 Cordis bundle。
- 安装继续兼容 CLI、profile lockfile、patch-layer 激活和打包 pnpm 运行时。
- 安装成功会持久保存，但重启前不会生效。
- 软件包安装会执行第三方代码。界面会说明这一信任要求，但不提供发布者验证、评分或精选插件市场目录。
- 安装器不会增加模型可见输入或 Session 事件，只会改变应用后续运行可用的 plugin 组合。
