# @deepseek-ai/dsh-host-plugin-installer

[English](README.md) | 中文

仅用于桌面 Host，把一个包规格或 Git 规格安装进可写 profile。`PluginInstallerGateway` 发布生成的直接 Remote `pluginInstaller/add`，再通过 `ctx.subprocess` 运行既有的 `dsh plugin --profile <profile> add -- <spec>` 路径。profile 初始化、pnpm 调用与 `dsh.bundle` 对账仍只由既有 CLI 负责。

Web app bundle 只在 `DSH_DESKTOP=1` 时启用该 Host 行；构造函数会重复检查该条件，并要求 CLI 入口是已存在的绝对路径。请求以单个、有长度上限且不是选项的 argv 值传入，不经过 shell 解析。同一时间只允许一次安装。subprocess 服务会限制两个输出流的尾部长度，并在请求取消、超时或插件卸载时终止整个进程树；Remote 以稳定的业务失败返回这些诊断。成功结果携带 `restartRequired: true`，因为当前活动 Loader 树不会围绕新安装的 profile layer 自动重写自身。

配置持有部署值：`cliEntry`、`profile`、`timeoutMs`、`maxOutputBytes`、`graceMs` 与 `maxSpecChars`。桌面应用提供 `DSH_DESKTOP_CLI_ENTRY`，打包版本还提供 `DSH_PNPM_ENTRY`；bundle 行把 CLI 入口映射到该插件配置，installer 则显式转发 pnpm 入口，因为 subprocess provider 会清除环境中所有 `DSH_*` 变量。

## 模型体验

无，因为这个仅限桌面端的 profile installer 只改变未来的 Loader 组合，不注册提示词、工具、消息或提供方输入。

#### KV Cache 影响

无；安装过程不会组装模型输入，也不会改变当前 Session 历史。

## 已知限制与暂缓事项

- **需要重启** —— 包事务成功后会更新磁盘上的 profile，但不会在运行中的 Loader 树内激活新 layer。
- **同时只允许一次修改** —— 并发安装请求会收到 `busy`；Remote 返回有长度上限的最终诊断，而不是包管理器的实时进度流。
