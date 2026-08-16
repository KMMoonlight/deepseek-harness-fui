# @deepseek-ai/dsh-host-runtime-updater

[English](README.md) | 中文

该包是仅限桌面端的官方 `@deepseek-ai/dsh` 受管运行时更新 Host provider。`RuntimeUpdaterGateway` 发布生成的 direct Remote：`runtimeUpdater/describe` 与 `runtimeUpdater/update`。除非 `DSH_DESKTOP=1`，否则 FUI bundle 会禁用该 provider；构造函数会重复检查这个标记，并要求 DSH 与 FUI 使用准确版本、兼容 DSH 范围是有效 semver、受管存储、覆盖层与 pnpm 路径为绝对路径、registry 使用 HTTPS 或回环地址。

一次更新请求会检查配置的 npm dist-tag，并且只在新版本落入当前桌面版本声明的兼容范围时安装官方 DSH。provider 会在 `$DSH_HOME/desktop-runtime` 下写入私有临时项目，通过 `ctx.subprocess` 调用应用内置的 pnpm 入口，以 hoisted linker 安装官方依赖闭包，再把应用资源中不可变的 FUI 包和 Web 前端复制到该闭包。官方 DSH 选择共用包版本，FUI 表面与更新器则保持桌面应用的准确版本。输出和执行时间都有上限，请求取消与 plugin 卸载共用同一生命周期；命令以 argv 数组执行，不经过 shell，并使用 subprocess provider 清除凭据后的环境变量。

安装不会修改应用资源。完整依赖树必须包含版本准确的官方 CLI、每个准确版本的 FUI 覆盖包与 Web 前端；本地 DSH manifest 还会声明 FUI bundle，使 profile fallback 能发现覆盖层。安装后的 CLI 必须通过 `dsh --version` 报告请求的版本。只有全部通过后，原子写入的 `current.json` 指针才会为下次启动选择该运行时。指针会记录 FUI 版本，因此新版桌面应用会拒绝旧的覆盖层组合，直到用户重新安装一个兼容运行时。已有但无效的版本目录会移入可恢复的隔离目录。Electron 壳启动前会再次校验指针；若启动失败，它会保留失败指针并回退到应用内置运行时。

以下部署值由配置持有：`currentVersion`、`currentSource`、`fuiVersion`、`compatibleDshRange`、`overlayRoot`、`runtimeRoot`、`pnpmEntry`、`registryUrl`、`distTag`、`checkTimeoutMs`、`installTimeoutMs`、`maxOutputBytes` 与 `graceMs`。包标识与覆盖包名单属于固定应用规则，不接受 renderer 输入。

## 模型体验

无。更新只会改变后续应用启动可用的 plugin 运行时，不注册提示词、工具、消息或 provider 输入。

#### KV Cache 影响

无；更新器不会组装模型请求，也不会追加 Session 事件。

## 已知限制与暂缓事项

- **需要重启**——提交的指针在下次桌面启动时生效；运行中的 Host 与 Client plugin 图不会变化。
- **声明的兼容范围**——如果官方 DSH 版本超出当前桌面版本声明的范围，界面会显示不兼容且不会安装。因此，上游破坏性变更仍需发布新版桌面应用，并更新 FUI 覆盖层与兼容范围。
- **仅更新运行时**——需要新版 Electron 壳的变更仍须发布完整且经过签名的桌面应用。
