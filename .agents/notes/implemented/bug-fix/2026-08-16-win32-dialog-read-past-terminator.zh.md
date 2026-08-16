# Agent Note：Win32 文件夹选择器不再越过终止符读取显示名

Status: implemented

[English](2026-08-16-win32-dialog-read-past-terminator.md) | 中文

## 问题

在 Windows 上打开工作区失败，报 `directory picker failed: win32 folder dialog worker exited before reporting a result`——[koffi 子进程选择器](../feature/2026-08-02-win32-in-process-folder-dialog.md)未及上报 IPC 结果就死掉了。两个缺陷叠加出了这条消息。

`readUtf16` 从 COM out 参数给出的裸地址提取选中路径时，用固定的 32 KB `koffi.view` 映射字符串所在内存并整体复制进 `Buffer`。这次复制不管 NUL 终止符在哪都读满 32 KB——越过终止符、读进可能未映射的堆页，这种读取就是原生访问违规（AV）。AV 不是 JS 异常：worker 进程直接死亡，`try`/`catch` 无从执行，driver 也收不到任何 `error` 消息。同一段扫描还只检查每个 UTF-16LE 码元的低字节，所以像 U+0100（`Ā`，低字节 `0x00`）这样的字符即便读操作活下来也会把路径截断。

driver 侧则把这一切藏在了一条无法行动的消息后面：它在子进程的 `exit` 事件上判定无声死亡——Node 并不保证 `exit` 排在仍在途的 IPC 消息之后——而且既不带退出码也不带信号。

## 决策

`readUtf16` 改为用 `koffi.decode(address, offset, 'uint16')` 一次读一个 UTF-16 码元，读到 NUL 即停，因此永不触碰终止符之外的内存；读过 `MAX_DISPLAY_NAME_UNITS`（32768，长路径上限）仍无终止符则抛出可捕获的错误，由 worker 经 IPC 上报，而不是故障崩溃。`koffi.view` 从 bindings 的 koffi 面中移除——整体读取字符串本身就是缺陷，而不是实现细节。

driver 的无声死亡判定从 `exit` 移到 `close`：`close` 只在 IPC 通道排空后触发，worker 已发出的任何结果都会先送达，且拒绝消息带上退出码与信号。`Win32DialogWorkerLike` 以 `close` 重载取代 `exit`；built-worker e2e 做同样的替换。

## 备选方案

- **保留整体 `view`，先扫描再复制。** 任何定长读取都会触碰终止符之后的页；AV 风险是"读得越界"本身固有的，与复制步骤无关。
- **`koffi.decode(addr, 'str16')`。** out 参数给出的是裸地址，`str16` 解码会把它当指针解引用——正是原注释警告过的崩溃。
- **在 `exit` 与拒绝之间隔一个宽限 macrotask。** `exit` 对在途消息没有送达保证，任何固定延迟都会在负载下重新引入竞态；`close` 才是文档约定的排空点。
- **回退到回退选择器层。** [回退链删除决策](../simplification/2026-08-04-drop-windows-powershell-picker-fallback.md)依然成立：两个缺陷都在 harness 侧，不是 OS 能力缺口，而崩溃隔离设计本身起了作用——宿主存活并上报了失败。

## 影响

结果提取不再可能让 worker 崩溃：逐码元读取在终止符处停止，无终止符的情形以已上报的错误明确失败。含零低字节字符的路径完整往返。仍然未上报就死去的 worker——spawn 层面的失败或别处的故障——会以带退出码与信号的拒绝呈现，且无法再遮蔽已经发出的结果。POSIX 行为不变，仅判定消息的文本变化。

## 测试

假 COM 堆只映射显示名及其 NUL 终止符，越过终止符的读取即抛错，因此每个选择测试都固定了逐码元边界；零低字节字符完整往返；无终止符的名称在上限内拒绝，同时仍释放 shell item 与对话框。driver 套件固定了在 `exit`-然后-`close` 之前发出的结果优先于终止事件，以及光秃的 `close` 以带 code/signal 的消息拒绝。
