# DeepSeek FUI 桌面端

[English](README.md) | 中文

Electron 应用负责持有一个 `dsh --profile fui` Host 进程，并在经过安全收紧的原生窗口中显示其回环 Web UI。桌面壳属于应用装配，不是 Cordis 插件；它启动的 Harness 进程仍然完全由插件组成。

## 开发

安装工作区依赖后运行：

```sh
pnpm run dev:desktop
```

该命令会先构建 Harness 包、Web 前端和 Electron 入口，再启动应用。关闭主窗口只会隐藏窗口，托盘继续持有 Host；再次点击应用图标会恢复现有窗口。通过托盘显式退出时，应用先停止 Host；若五秒宽限期后仍未退出，则升级终止操作。

renderer 只能在 Host 输出的回环来源内导航。其他来源的 HTTP 和 HTTPS 链接交给系统浏览器打开；新窗口会被拒绝；renderer 关闭 Node 集成，启用上下文隔离和沙箱，并拒绝页面权限请求。兼容沙箱的 preload 会在 renderer 文档可用时标记 Electron 壳和 macOS 标题栏 overlay。FUI 命令栏随即成为原生拖拽区，其中的交互控件仍可点击，并为 macOS 窗口按钮预留间距。原生窗口可通过平台控件和窗口边缘移动、缩放、最小化、最大化及进入全屏。

## 打包

为当前平台生成未封装应用：

```sh
pnpm run package:desktop
```

生成配置的分发产物（`dmg`/`zip`、`nsis` 或 `AppImage`）：

```sh
pnpm run dist:desktop
```

两个命令都会执行完整仓库构建，并暂存封闭的生产依赖树。打包应用通过 Electron 的 Node 模式运行暂存的 CLI，因此无需另装 Node.js 或 pnpm。若产物缺少 CLI、Web 前端或内置 pnpm 入口，打包检查会直接失败。

## 插件与用户数据

应用启动的是 `~/.dsh/profiles/fui` 下的普通可写 `fui` profile。如果已选中经过校验的受管运行时，内置 bundle 从中加载；否则使用不可变的打包运行时。第三方 profile bundle 及其 lockfile 留在用户 profile 中，因此运行时更新与应用升级都不会清除它们。

打包 Host 通过 `DSH_PNPM_ENTRY` 获得内置 pnpm 入口。打开**设置 → 插件 → 安装插件**，输入一个 npm 包或 Git 规格，即可提交给仅限桌面端的安装器。Host 不经过 shell，也不依赖登录 shell，直接调用现有 profile 命令：

```sh
dsh plugin --profile fui add <package-or-git-spec>
```

安装会改变应用可执行代码的组成，因此只能使用可信来源的包。桌面端同一时间只运行一个安装任务，并限制输出大小和执行时间；关闭该设置页会取消请求。安装成功后，需要重启桌面应用，新 bundle 才会生效。当前表单接受包规格或 Git 规格；目录浏览、包评分和发布者验证仍属于分发服务职责。

## 运行时更新

**设置 → 通用设置 → 桌面运行时**会显示当前 `@deepseek-ai/dsh` 版本。点击**检查并更新**后，应用会读取配置的 npm dist-tag，并自动把兼容的新运行时安装到 `$DSH_HOME/desktop-runtime`。它不会修改应用资源或全局 npm 安装。

兼容性检查采用失败即拒绝：发布的根包必须声明 `@deepseek-ai/dsh-fui-app`；安装后的依赖树必须包含 FUI bundle 与 Web 前端；CLI 必须报告请求的版本。安装成功后，完全重启应用才会激活新版本。Electron 会在启动前再次校验受管依赖树；如果依赖树无效，或 Host 在就绪前失败，应用会保留相关数据用于诊断，并回退到内置运行时。没有 FUI bundle 的 npm 版本会报告不兼容，不会安装。

## 已知限制

首个 Electron 装配有意复用回环 HTTP/WebSocket carrier。后续可以迁移到已预留的 Electron IPC carrier，而无需改变 FUI 插件 roster 或 Host 服务。

仓库不包含分发签名和公证凭据。操作系统打开本地未签名产物前，可能需要平台专用的开发环境放行操作。

`apps/desktop` 是唯一的桌面壳，拥有根目录桌面命令和分发产物。

## 模型体验

桌面壳不会增加模型可见输入。FUI profile 及其已安装 bundle 持有与其他启动表面相同的、可记录的模型上下文。
