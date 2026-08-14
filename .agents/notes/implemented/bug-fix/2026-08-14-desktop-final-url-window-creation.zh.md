# Agent Note: 桌面端使用后端 URL 创建 webview

Status: implemented

[English](2026-08-14-desktop-final-url-window-creation.md) | 中文

## 问题

在 macOS 上，桌面应用会先按照配置创建指向内置占位页的主 webview，并在 Tauri setup 期间同步启动后端。后端就绪后，setup 会对现有 webview 调用 `navigate()`。此时 WebKit 可能仍在处理初始导航策略，第二次导航会输出一个以 `WebFramePolicyListenerProxy::ignore(WebKit::WasNavigationIntercepted)` 结尾的原生堆栈。后端与应用仍可使用，但每次开发环境启动都像发生了原生故障，而且执行顺序依赖 WebKit 时序。

## 决策

Tauri 配置不声明主窗口。Setup 启动由桌面端拥有的后端，等待它打印回环 URL，再通过 `WebviewWindowBuilder` 和 `WebviewUrl::External` 创建 `main`。Webview 的首个请求就是最终后端 URL，因此不会有第二次导航与初始 WebKit 策略决策竞争。

窗口标题、初始尺寸、最小尺寸、FUI 背景色、single-instance 处理、托盘行为、窗口状态持久化和进程组清理仍由桌面进程拥有。后端启动失败时，进程会在 webview 创建前退出，并报告保留的 stderr 末尾。

## 验证

macOS 启动回归会真实运行 Tauri 应用，等待后端就绪行，在窗口创建后继续保持运行，并扫描输出中的 `WasNavigationIntercepted` 与 `WebFramePolicyListenerProxy::ignore`。同一命令在本决策前可复现该堆栈，修改后会干净退出，且不包含任一标记。Rust 编译与测试覆盖其余进程选择和生命周期辅助逻辑。

## 考虑过的替代方案

- **保留占位页并稍后调用 `navigate()`**：否决，因为观测到的故障来自初始策略决策与第二次导航的执行顺序；增加任意延迟仍会保留竞态。
- **让占位页 JavaScript 轮询就绪状态后重定向**：否决，因为这会增加一条浏览器到原生端的就绪通道，仍会执行第二次导航，而且不会改善失败报告。
- **抑制原生堆栈**：否决，因为过滤 stderr 会隐藏其他 WebKit 诊断，并保留时序缺陷。
- **由后端提供占位页**：否决，因为后端就绪后不再需要占位页，而后端失败时也无法提供它。

## 后果

- 桌面窗口只在后端报告就绪后出现。启动期间没有原生加载界面。
- 后端失败会在终端输出诊断，不会闪现空窗口。
- WebKit 只接收一次应用导航，在不修改回环传输或后端生命周期的情况下消除拦截导航堆栈。
- 打包应用仍需提供文档所述的 Node sidecar 与原生启动失败对话框。
