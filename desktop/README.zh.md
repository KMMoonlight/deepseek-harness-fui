# desktop：FUI 桌面外壳

[English](README.md) | 中文

一个 Tauri 应用，其窗口显示由自身拥有的 `dsh --profile fui` 进程。它让后端监听操作系统分配的端口，从 Web 组合包打印的 URL 行中读回端口，再使用最终 URL 创建 webview。

本目录有意位于 pnpm Workspace 之外。它没有自己的 JavaScript，加载的页面由后端提供，因此增加 `package.json` 只会让一个 Rust crate 进入 Workspace 包门禁。

## 为什么使用进程外后端

这是由 harness 的两项属性决定的：

- **客户端 plugin 通过注入的 `<script>` 标签到达页面**。`file://` origin 无法提供这些脚本；外壳唯一的替代接口是传输覆盖，但这会引入一套需要自行编写和维护的实现。
- **Tauri 使用系统 webview**，因此该进程中没有 Node 运行时；即便页面位于本地，也无法在这里承载 harness。

回环 HTTP 同时解决了这两个问题，且不会放宽安全姿态：harness 已经把 `/api` 限制在回环 authority，并拒绝非回环绑定。

## 进程生命周期

后端由三个进程串联而成：`pnpm` 启动器 shim、解析后的 pnpm，以及 tsx host。只有最后一个进程持有端口。仅终止最初 spawn 的进程无法回收实际服务，因此子进程在自己的进程组中启动，每条退出路径都会向整个组发送信号。

| 退出方式 | 行为 |
|---|---|
| 关闭窗口 | `CloseRequested` 回收进程组。 |
| 应用退出 | `Exit` run event 回收进程组并清理 pid 文件。 |
| SIGTERM / SIGINT / SIGHUP | 处理器终止进程组，再恢复默认信号处理并重新触发信号，因此退出状态保持真实。Tauri 不为这些信号安装处理器；若缺少该逻辑，supervisor 的 SIGTERM 会遗留后端。 |
| SIGKILL | 无法捕获。下次启动会回收记录的 pid，避免孤儿进程持续累积。 |

信号处理器从 atomic 中读取进程组 id，而不是使用其他代码访问的 mutex。在信号处理器内获取锁不满足 async-signal-safe 要求。

一项值得了解的观测行为是：SIGKILL 后，后端经常会自行退出，因为它向一个已经失去读取方的 stdout 管道写入。这不是保证，因此启动时仍会执行回收。

## 运行方式

先构建一次仓库（`pnpm run build`），然后在仓库根目录执行：

```sh
cargo run --manifest-path desktop/Cargo.toml
```

这就是完整步骤。外壳会启动后端，找到满足版本要求的 Node，等待 URL，然后在后端就绪后创建窗口。使用最终 URL 创建 webview 也避免了 macOS WebKit 在 Tauri setup 期间从内置占位页导航离开时输出的导航策略堆栈。

### 如何选择 Node

Harness 要求 Node `^22.19.0 || >=24`。更低版本的 `node:zlib` 不提供 `createZstdDecompress`，plugin 加载会因此报出与 Node 版本无直接关联的模块导出错误。`PATH` 中的首个 `node` 经常不满足要求，这是开发机环境的常见属性，因此外壳会自行解析合适版本。

解析顺序为：先检查 `DEEPSEEK_FUI_NODE_BIN`，再检查环境中的 `node`，最后从 nvm、fnm 或 volta 已安装的版本中选择最新的合格版本。启动时会打印所选目录。只有所有来源都找不到合格版本时，外壳才会拒绝启动，并报告检查过的位置。

`DEEPSEEK_FUI_NODE_BIN` 也是打包构建使用的接口。让它指向随应用分发的 Node 后，外壳便不再依赖启动环境。

### 后端启动失败时

错误消息会包含后端 stderr 的最后 40 行。外壳会报告错误并退出，不会从 setup 返回 error。Tauri 会在一个无法 unwind 的回调内把后者转为 panic，操作方只能看到 abort 和 Rust backtrace，而看不到实际原因。

## 已知限制与暂缓事项

- **仅支持开发环境启动**：后端从仓库根目录通过 `pnpm` spawn。打包应用必须携带 Node 运行时和 harness sidecar，并把 `DEEPSEEK_FUI_NODE_BIN` 指向该运行时；在此之前，从 Finder 启动会失败，因为 macOS GUI 进程不会继承 shell 的 `PATH`。
- **启动失败时没有对话框**：错误原因和 harness 的 stderr 末尾会写入本进程 stderr，因此从图标启动的用户只会看到窗口未出现。仍需增加原生对话框。
- **90 秒就绪超时是经验值**：对于已有缓存的开发环境足够宽松，但在性能较低设备的冷启动中可能不足。
- **托盘、菜单和窗口状态行为尚未验证**：三者都已注册，应用启动也没有错误，但其正确性需要通过屏幕交互确认，本构建只执行了 headless 检查。single-instance 已验证：第二次启动会退出，且不会启动第二个后端。
- **SIGTERM 不保存窗口状态**：信号处理器会恢复默认处理并重新触发信号，因此 Tauri 退出路径不会运行，状态 plugin 也不会写入。回收后端比记住窗口大小更重要，但只有正常关闭或通过托盘退出才会保存窗口几何。
- **应用图标仍为生成的占位图**：仍需提供符合各平台打包尺寸要求的正式品牌图标。
