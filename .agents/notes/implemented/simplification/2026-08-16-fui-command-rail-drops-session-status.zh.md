# Agent Note: FUI command rail drops its session status group

Status: implemented

[English](2026-08-16-fui-command-rail-drops-session-status.md) | 中文

## Problem

FUI 命令栏右端曾带有一个自行添加的状态组（"会话链路"标签加实时会话状态徽标）。早于 FUI 界面的第三方客户端插件按 stock 外壳（没有全局顶栏）的假设，用 `position: fixed` 把自己的控件钉在视口右上角，恰好压在这个状态组上（在 dsh-better-sidebar 上观察到）。该组信息与对话界面已呈现的内容重复，且"会话链路"的标签读起来像轨迹入口，实际表达的却是会话状态。

## Decision

`packages/client/ui-fui-layout` 的命令栏只渲染产品标识（`DSH // 智能体控制台`）；会话状态组、它的 locale 键（`command.session`、`session.syncing`、`session.idle`、`session.running`、`session.ready`）及对应 CSS 一并移除。命令栏右侧保持为空，与 stock 外壳"视口右上角不放置外壳自有内容"的保证一致，fixed 定位的插件悬浮层因此没有可碰撞的目标。这是对 [FUI runtime client surface](../architecture/2026-08-14-fui-runtime-client-surface.md) 笔记中命令栏构成的部分取代；该笔记的事实已就地更新。

## Alternatives considered

- **保留状态组并在命令栏上方预留空带**：否决——它为一个外壳本不需要的元素花掉每个 FUI 界面 40px；移除元素是更小的设计。（空带曾在同一改动窗口内实现并回退。）
- **改名或挪位徽标**：否决——会话运行状态已在对话列呈现；一个重复的全局指示器在与插件生态的假设相撞后没有理由保留。
- **保留状态组、靠插件侧补丁挪开悬浮层**：否决——逐插件打地鼠，且该组本来就不是承重结构。

## Consequences

- 视口右上角重新没有外壳内容；带着 stock 外壳 fixed 定位假设的插件（dsh-better-sidebar 的开关按钮簇）不再与 FUI 界面重叠。
- 实时会话状态只从对话界面读取，没有全局替代品。
- `fui-layout` locale 命名空间收缩为 `skip.main`、`command.title`、`status.profile`、`status.workspace`；`Badge` 导入离开 `AppFrame`。

## Testing

`app-frame` 组件测试移除了徽标断言；装配后的 `fui-surface` golden 刷新为 `DSH // Agent console`、无状态尾部的命令栏。macOS 标题栏间距与拖拽区行为维持空带方案之前的设计不变。
