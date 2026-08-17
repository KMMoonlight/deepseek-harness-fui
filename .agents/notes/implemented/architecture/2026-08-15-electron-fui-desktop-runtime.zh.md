# Agent Note：Electron 打包 FUI profile 及其插件运行时

Status: implemented

[English](2026-08-15-electron-fui-desktop-runtime.md) | 中文

## 问题

原生桌面窗口可以监管 `dsh --profile fui`，但从仓库 checkout 中发现 Node 与包管理器命令的开发启动方式无法成为自包含应用。从图标启动的打包应用不能依赖登录 shell 的 `PATH`，而封闭应用包仍须保留 Harness 的 profile bundle 安装模型，不能把 FUI 组合固化成桌面端代码。

应用职责也必须清楚。Cordis plugin 扩展 Harness 进程；操作系统应用负责进程启动、原生窗口、单实例行为、导航策略、托盘生命周期和分发产物。若把桌面壳也视为 Cordis plugin，就没有先于它存在的进程来加载这个 plugin。

## 决策

`apps/desktop` 是私有 Electron 应用。它以 `--profile fui --host 127.0.0.1 --port 0` 启动构建后的 `@deepseek-ai/dsh` CLI，只接受规范的回环就绪 URL，并为该来源创建一个沙箱 renderer。Electron 负责单实例激活、窗口恢复、托盘生命周期、外部链接转交、权限拒绝、启动诊断和有界 Host 退出。

preload 会标记 Electron renderer，但不暴露 IPC bridge。FUI 命令栏根据该标记成为原生拖拽区，同时排除交互子元素。BrowserWindow 配置明确允许窗口移动、边缘缩放、最小化、最大化和全屏，并保留平台原生窗口控件。

打包应用通过 `ELECTRON_RUN_AS_NODE=1`，把自己的 Electron 可执行文件作为 Host 的 Node 运行时。`pnpm deploy` 暂存一棵封闭的生产依赖树，其中包含 CLI、Base/Web/FUI bundle、Web 前端、所有必需的工作区 peer 以及 pnpm。暂存阶段会在 Electron Builder 把依赖树复制进应用资源前实体化工作区链接；after-pack hook 则检查 CLI、前端和 pnpm 三个执行入口。从 Harness 用户存储中选中[带应用 FUI 覆盖层的独立官方 DSH 运行时](2026-08-16-independent-official-dsh-desktop-overlay.md)后，这棵依赖树仍作为不可变回退。

普通可写的 `fui` profile 仍位于 `~/.dsh/profiles/fui`。内置 bundle 从打包安装中解析；第三方 bundle 依赖及其 lockfile 留在 profile 中。桌面 Host 通过 `DSH_PNPM_ENTRY` 提供打包的 pnpm JavaScript 入口；`dsh plugin` 随后使用当前兼容 Node 的可执行文件运行该入口，不再解析 shell 命令。[封闭式安装决策](2026-08-17-hermetic-desktop-plugin-installs.md)补全了这条链：Host PATH 上的 node/pnpm 包装与经 API 钉 commit 的 GitHub 规格，使插件安装完全不依赖系统工具链。这属于部署接线，而不是第二套插件安装器：依赖对账和 `dsh.bundle.patch` 激活仍由现有 profile 命令负责。

仅限桌面端的插件安装器通过有界 Host Remote 和 Client 设置页公开这条命令。它只接受一个包或 Git 参数，不调用 shell，串行执行 profile 变更，限制保留输出与执行时间，并把请求取消和 plugin 卸载合并进同一生命周期。普通 Web 组合会禁用这两行。安装成功会修改磁盘上的 profile；应用重启后，新安装的 bundle 才会进入运行中的 plugin 图。

renderer 初期复用 Web Host 的回环 HTTP/WebSocket carrier。这是一项分阶段的应用传输选择；[GUI 协议决策](2026-07-19-gui-layering-and-rpc-protocol.md)仍为 Electron IPC carrier 保留位置。Client plugin 图、FUI 组合和 Host 服务不依赖后续 carrier 变更。

## 验证

Host supervisor 测试覆盖分块就绪解析、非法来源、启动失败、就绪超时、意外退出、合并退出和 SIGKILL 升级。窗口生命周期测试覆盖关闭时隐藏、恢复、并发创建和回收失败。进程适配测试固定 `fui` profile 参数与 Electron Node 环境。打包检查固定暂存的 FUI、前端和 pnpm 依赖，以及可移动、可缩放的 BrowserWindow 配置。装配后的 FUI 浏览器验收会验证原生拖拽区及其交互控件排除规则。安装器测试固定准确的 CLI argv、桌面端加载限制、串行变更、诊断、超时、取消和卸载行为；Client 测试覆盖延迟调用和每一种可见结果状态。打包应用的交互式冒烟测试通过命令栏移动了窗口，并通过窗口边缘完成缩放。构建后 CLI 验收套件会运行一个伪造的打包 pnpm 入口，并验证新初始化的 `fui` profile 保留全部三层内置 bundle。

## 考虑过的替代方案

- **把桌面壳改成 Cordis plugin**：否决，因为 Harness 进程存在前，plugin 无法持有安装、进程创建或操作系统应用生命周期。
- **使用发现系统 Node 的原生壳**：否决其作为分发路径，因为图标启动仍取决于机器设置，而单独装配运行时会重复 Electron 已经携带的 Node 兼容运行时。
- **把已安装插件固化进应用资源**：否决，因为资源属于不可变应用状态；profile 依赖和 lockfile 属于用户状态，必须在应用替换后保留。
- **要求系统 pnpm 完成插件安装**：否决，因为 GUI 应用无法获得可靠的 shell 环境，而自包含应用必须携带自己的包管理器。
- **先实现 Electron IPC 再打包**：暂缓，因为这会把 carrier 迁移与分发基础合并在一次改动中。回环 carrier 已有来源检查，并能保留当前 Client/Host 协议。

## 后果

- 用户点击已安装应用的图标即可启动；无需启动命令，也无需另装 Node/pnpm。
- FUI 命令栏在 Electron 中属于原生窗口区域；以后加入的交互子元素必须继续排除在拖拽区之外。
- 第三方 Cordis plugin 仍可通过桌面设置表单作为 profile bundle 安装。安装属于可信代码执行，新 bundle 生效前必须重启应用。
- 兼容的已发布 Harness 依赖闭包可以从受管用户存储中选中；无效选择会回退到不可变的打包依赖闭包。
- Electron、完整 FUI 运行时和 pnpm 会一起分发，因此桌面产物更大。
- `apps/desktop` 是唯一的桌面应用，并拥有可打包的根目录命令。平台签名属于发布工作，而不是第二套桌面壳实现。
- Electron 壳不会增加模型可见输入；Session 日志和模型上下文仍由挂载的 Harness plugin 持有。
