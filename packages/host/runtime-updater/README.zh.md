# @deepseek-ai/dsh-host-runtime-updater

[English](README.md) | 中文

该包是仅限桌面端的受管 `@deepseek-ai/dsh` 运行时更新 Host provider。`RuntimeUpdaterGateway` 发布生成的 direct Remote：`runtimeUpdater/describe` 与 `runtimeUpdater/update`。除非 `DSH_DESKTOP=1`，否则 FUI bundle 会禁用该 provider；构造函数会重复检查这个标记，并要求版本为准确的 semver、受管存储路径与 pnpm 路径为绝对路径、registry 使用 HTTPS 或回环地址。

一次更新请求会检查配置的 npm dist-tag，并且只安装版本更高、发布依赖图中包含 `@deepseek-ai/dsh-fui-app` 的包。provider 会在 `$DSH_HOME/desktop-runtime` 下写入私有临时项目，通过 `ctx.subprocess` 调用应用内置的 pnpm 入口，限制输出与执行时间，并把请求取消和 plugin 卸载合并进同一生命周期。子进程使用 subprocess provider 清除凭据后的环境变量。包管理器与校验命令都以 argv 数组执行，不经过 shell。

安装不会修改应用资源。完整依赖树必须包含版本准确的 CLI、FUI bundle 与 Web 前端，安装后的 CLI 还必须通过 `dsh --version` 报告相同版本。只有全部通过后，原子写入的 `current.json` 指针才会为下次启动选择该运行时。已有但无效的版本目录会移入可恢复的隔离目录。Electron 壳启动前会再次校验指针；若启动失败，它会保留失败指针并回退到应用内置运行时。

以下部署值由配置持有：`currentVersion`、`currentSource`、`runtimeRoot`、`pnpmEntry`、`registryUrl`、`distTag`、`checkTimeoutMs`、`installTimeoutMs`、`maxOutputBytes` 与 `graceMs`。包标识和 FUI 依赖要求属于固定安全规则，不接受 renderer 输入。

## 模型体验

无。更新只会改变后续应用启动可用的 plugin 运行时，不注册提示词、工具、消息或 provider 输入。

#### KV Cache 影响

无；更新器不会组装模型请求，也不会追加 Session 事件。

## 已知限制与暂缓事项

- **需要重启**——提交的指针在下次桌面启动时生效；运行中的 Host 与 Client plugin 图不会变化。
- **需要发布 FUI**——如果上游 `@deepseek-ai/dsh` 版本没有包含 `@deepseek-ai/dsh-fui-app`，更新器会报告不兼容，且不会安装。
- **仅更新运行时**——需要新版 Electron 壳的变更仍须发布完整且经过签名的桌面应用。
