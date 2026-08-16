# Agent Note: 桌面端组合独立发布的官方 DSH 与应用 FUI 覆盖层

Status: implemented

[English](2026-08-16-independent-official-dsh-desktop-overlay.md) | 中文

## 问题

官方 `@deepseek-ai/dsh` 与 FUI 桌面应用由不同发布者维护，发布节奏也彼此独立。如果要求官方 DSH 包依赖本应用的 FUI bundle，桌面端只有等三个产物同步发布后才能采用普通官方功能。原地更新经过签名的应用资源不可接受，让 renderer 自行组合任意包集合又会暴露过多进程与文件系统权限。

桌面端仍然需要一套可启动的组合。官方更新可能改变共用 Host、Client 或 plugin 包，而 FUI 表面、Web 资源与更新协议属于已安装应用。如果没有明确兼容规则就组合这些输入，可能会选中应用覆盖层无法加载的官方版本。

## 决策

桌面端通过 `dshDesktop.compatibleDsh` 声明当前准确 FUI 版本支持的官方 DSH semver 范围。运行时更新器读取配置的官方 npm dist-tag，并且只在更高的准确 `@deepseek-ai/dsh` 版本落入该范围时安装。该范围有意包含预发布版本。范围外版本会报告不兼容，活动运行时保持不变。

更新器在 `$DSH_HOME/desktop-runtime` 下创建私有项目，用 pnpm 的 hoisted linker 只安装官方 DSH 根包，随后从不可变应用资源向受管根目录复制一份固定的应用自有 FUI 包名单：FUI bundle、FUI Client 包、桌面更新器两端与 Web 前端。本地受管 DSH manifest 会增加一项指向准确版本 `@deepseek-ai/dsh-fui-app` 的依赖，使官方 profile fallback 遍历能够发现覆盖层。其余依赖闭包由官方包提供，因此非 FUI 功能跟随选中的官方版本。

更新器 Remote 由 `dsh-client-ui-settings-runtime-updater` 通过通用 API Gateway 挂载，而不是加入官方 `dsh-api-remotes` 组合。这样，应用协议留在 FUI 覆盖层中，后续兼容的官方版本新增的 Remote 贡献也不会被替换。

受管依赖树只有同时满足以下条件才会被接受：官方包标识与版本相符，版本落入桌面兼容范围，每个应用覆盖包都具有准确 FUI 版本和必需入口，修补后的 DSH manifest 选择该 FUI 版本，且 CLI 报告请求的版本。`current.json` 同时记录官方 DSH 与 FUI 版本，只在校验完成后生效。Electron 启动前会再次进行结构校验，优先尝试受管 Host，把被拒绝的指针或就绪失败移入隔离位置，并保留不可变的打包运行时作为回退。新版本只有在应用完全重启后才会激活。

已归档的[同版本包闭包方案](../../archived/feature/2026-08-16-desktop-managed-runtime-updates.md)保留为历史背景；本决策取代其中“官方 DSH 必须发布 FUI bundle”的要求。

## 验证

Host 测试覆盖独立 registry 元数据、范围接受与拒绝、hoisted 官方安装命令、应用覆盖层复制、准确覆盖层校验、本地 DSH manifest 增补、CLI 冒烟、原子指针选择、取消、超时与隔离。Electron 测试覆盖把应用期望传给指针校验，以及从受管运行时回退到打包运行时。Client 测试覆盖私有 Remote 挂载、显示 DSH/FUI/范围信息、更新状态、取消与本地化不兼容提示。装配后的桌面 FUI 验收通过真实 Host 与 Client 组合记录设置行，同时不发起 registry 请求。

## 考虑过的替代方案

- **协调发布官方 DSH、FUI bundle 与 Web 前端**：否决，因为这些项目发布者不同，普通官方功能不应等待桌面版本。
- **用官方闭包替换所有应用包**：否决，因为官方 DSH 不持有也不发布这个 FUI 表面与 Web 前端。
- **覆盖完整的应用内置 Harness 闭包**：否决，因为应用的共用包副本会遮蔽官方版本的新功能。
- **接受每个更高的官方 DSH 版本**：否决，因为破坏性的 API、配置或组合变化需要更新 FUI 覆盖层。
- **修改应用资源或使用全局安装**：否决，因为签名资源必须保持不可变，图标启动必须自包含，而且版本选择需要原子回退。

## 后果

- 兼容的官方 DSH 版本可以直接在应用内安装，无需同步发布 FUI 或桌面版本。
- 官方破坏性变化需要新的桌面构建来适配 FUI 覆盖层，并修改 `dshDesktop.compatibleDsh`。
- 设置中显示的 FUI 版本属于已安装应用；更新官方 DSH 不会更新 FUI 表面或 Electron 壳。
- 后续桌面版本会拒绝携带不同 FUI 版本的指针，并使用内置回退，直到选中兼容的受管依赖树。
- 官方更新与第三方 profile plugin 安装仍是两项独立操作。profile 数据和已安装第三方 plugin 继续位于 `$DSH_HOME/profiles/fui`。
- 更新器不会增加模型可见输入或 Session 事件。
