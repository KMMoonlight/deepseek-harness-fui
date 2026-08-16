# Agent Note: FUI status rail hosts the session stats line

Status: implemented

[English](2026-08-16-fui-status-rail-hosts-stats.md) | 中文

## Problem

会话统计行（轮/步、LLM 墙钟时间、首 token 延迟与吞吐、缓存命中、计费 token）之前只渲染在输入框下方、对话滚动容器之内——远离 FUI 外壳自身的界面区，也不在用户期望看到环境读数的状态栏里。移动它看似平常，但撞上一个框架约束：root 作用域的 slot 组件只拿到全局席位（`useSessions`/`useWorkspaces`），而统计行的数据在 session 作用域标准套件钩子（`useSession`、`useProjection`）之后。

## Decision

`ui-fui-layout` 新声明一个 session 作用域的 list slot `'shell.status'`，并在状态栏 workspace 段之后渲染它。session 作用域是重点：挂载在那里的条目由框架注入 session 标准套件，因此 `StatsLine` 原样注册即可——外壳自身不读投影数据。`ui-conversation` 保留 `conversation.composer.dock` 原注册（stock 组合没有 `shell.status` 声明，那里一切不变），并新增一条 `slots.inject('shell.status', …)` 注册，只在 FUI 组合中安装。在 FUI 内，一条 `body[data-fui-surface] [data-slot='conversation.composer.dock']` 规则隐藏 dock 实例，让这行恰好只有一个可见归宿；一条 `[data-slot='shell.status']` 覆盖把居中的 composer 轴线样式换成状态栏样式。状态栏的固定标识段（profile、workspace、产品名）nowrap 且 `flex-shrink: 0`；统计行不参与 flex 排布，而是渲染在 `statusSlot` 里——一条绝对定位拉伸的带，内联 `left`/`right` 取自列宽求解结果，因此任意列宽下统计行都居中在输入框轴线上，过长时在带内省略号截断。没有当前会话时，严格的 session 作用域不挂载任何内容，状态栏也不显示占位。

## Alternatives considered

- **让 root 作用域的 AppFrame 自己读统计**：否决——root 组件拿不到 `useProjection`；框架的 session provide 通道刻意是 session 作用域席位，为一个消费者在 web-react 上开 root 读取通道是在扩大框架。
- **直接改注册目标（stock 失去统计行）**：暂不采用——所有含统计行的 stock 对话 golden 都要刷新，而 `cordis-tool-round` 回放夹具当前已损坏（其 llm-replay 脚本需要带 key 重录），此时刷新会把坏状态固化进 golden。等该夹具修复后仍可再做彻底移动。
- **按界面分叉组件**：否决——一个组件一条数据路径，只有挂载点和外观不同。

## Consequences

- FUI 在状态栏显示统计行；stock `dsh web` 逐位不变，包括全部 stock golden。
- `StatsLine` 在 FUI 组合中挂载两次（dock 实例被 CSS 隐藏）；两者读同一批共享投影 store，成本仅多一棵 React 子树。
- `'shell.status'` 是公开的追加式座位：任何插件都可以向 FUI 组合的状态栏贡献读数，session 作用域。
- `ui-conversation` 新增对 `dsh-client-ui-fui-layout/client` 的纯类型依赖以获得 SlotMap 合并（devDependency + tsconfig reference，与既有 `ui-layout` 引入同模式）。

## Testing

`ui-fui-layout` 的 apply 测试固定 `'shell.status'` 声明（`list`/`session`）；app-frame 测试断言状态栏的 renderSlot 调用。两个包既有 474 个测试原样通过，包括 StatsLine 的全部行为覆盖。golden 零变化：FUI 界面 golden 覆盖无会话状态（空座位），stock golden 未触碰。桌面组合中状态栏的统计行经由 dock 实例本就在用的同一批投影渲染。
