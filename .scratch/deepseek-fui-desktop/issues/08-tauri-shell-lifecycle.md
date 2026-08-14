# 08 — Tauri 壳：spawn 与进程生命周期

**What to build:** Tauri 桌面应用启动时拉起 dsh 后端并加载其界面，且在所有退出路径下都不留孤儿进程。

采用"外部进程 + 本地回环"而非把后端嵌进壳里，有两个具体原因：dsh 的 client 插件是通过外部 script 注入页面上下文加载的，走 `file://` 会撞上这条链路（上游只留了一个覆盖口子需要自行实现）；而 Tauri 用的是系统 webview，本身也无法内嵌 Node 宿主。走回环则这两个问题都不存在，且 dsh 已有的本地信任围栏正好覆盖这个部署形态。

进程回收是这一票的真正难点，三条退出路径都要覆盖，其中"前端被强杀"最容易漏。

**Blocked by:** 04

**Status:** done —— 一条验收按现实调整，见下

- [x] 以 `--port 0` 拉起自有 profile，从 URL 行读出实际端口（实测拿到 49250）后加载界面
- [x] 就绪前显示 FUI 风格加载态（`placeholder/index.html`），就绪后导航过去
- [x] 正常关闭窗口后子进程退出（`CloseRequested` 回收进程组）
- [x] **SIGTERM / SIGINT / SIGHUP 实测子进程归零**；SIGKILL 无法捕获，由下次启动回收，实测重启后为 3 而非 6
- [ ] ~~后端异常退出时界面给出可读提示~~ 目前只有 stderr，见遗留
- [x] 连续重复启动不会因端口占用失败（`--port 0` 每次由 OS 分配）

## 关键实现：必须杀进程组，不能杀子进程

`pnpm dsh` 是**三段链** —— pnpm 启动 shim → 解析后的 pnpm 11.7.0 → tsx 宿主，
而**只有最后一段持有端口**。第一版记录并杀 `child.id()`（即 shim），结果重启后变成 6 个后端进程。
改为 `.process_group(0)` 让子进程独立成组，退出路径统一 `killpg`。

## 补装信号处理

Tauri **不给 SIGTERM/SIGINT/SIGHUP 装 handler**，所以 `kill` 掉应用时退出路径根本不跑，后端全留。
实测确认后补了 handler：杀组 → 恢复默认处置 → 重新 raise（保持退出码诚实）。
handler 里读的是 `AtomicI32` 而不是 Mutex —— 信号处理中加锁不是 async-signal-safe。

## 观察到的非确定行为

SIGKILL 之后后端**有时会自己死**（它往一个读端已消失的 stdout 管道写，收到 SIGPIPE），有时不会。
这是偶然而非保证，所以启动期回收不能省。

## 遗留

- 启动失败只写 stderr，从图标启动的用户只会看到窗口消失 —— 需要一个原生对话框
- 目前只能开发态启动（`pnpm` 需在 PATH 上）；打包版要靠工单 10 的 sidecar
- 90 秒就绪超时是拍的，冷仓库 + 慢机器可能不够
