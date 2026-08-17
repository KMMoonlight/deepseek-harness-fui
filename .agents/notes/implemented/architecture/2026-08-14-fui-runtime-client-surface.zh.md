# Agent Note: FUI 组件作为共享运行时客户端模块

Status: implemented

[English](2026-08-14-fui-runtime-client-surface.md) | 中文

## 问题

FUI profile 修改了原应用的配色 token，并用一个几乎相同的 fork 替换应用框架，同时在外壳根节点之外用独立探针渲染了一个 f-ui 组件。这种做法证明了 Tailwind 流水线可用，却没有让 f-ui 进入运行时客户端组合。侧栏、对话外壳、输入区、菜单与状态展示仍沿用原视觉语法；运行时 plugin 也无法导入 `@deepseek-ai/dsh-client-ui-fui`，因为浏览器模块表没有提供它。

原 Web profile 与 FUI profile 共用一个前端 dist。更深入的 FUI 应用必须保留 plugin 花名册、React 单例、slot 所有权和原 Web profile，同时允许运行时客户端组合包使用 vendored 展示组件库。

## 决策

`@deepseek-ai/dsh-client-ui-fui` 是浏览器平台模块。[`PLATFORM_MODULES`](../../../../packages/client/web/README.md) 同时驱动静态种子表和客户端组合包 external，因此运行时展示 plugin 会导入应用拥有的同一个 f-ui 与 React 实例。FUI 布局从该模块导入 `Badge` 和 `ScreenEffects`，不会把它们再次打包。

[`ui-fui-layout`](../../../../packages/client/ui-fui-layout/README.md) 根节点拥有上部命令栏、底部界面状态栏、f-ui 网格、屏幕效果和窄窗口精简规则。它保留现有 slot 树、列宽解析器、拖动行为、详情生命周期和主题展示转换器。功能包保留原行为，并通过限定在 `body[data-fui-surface]` 下的规则提供 FUI 密度、方形控件、会话行描边选中态与终端字体。这些规则覆盖设置外壳及其通用、模型、Agent 预设、可配置插件和插件清单页面，也覆盖主要 Workspace。原 Web profile 不设置该属性，因此保留原有几何。

配色设有可读性底线：弱化与次要文字保持 72% 钢蓝透明度，结构线 62%，面板表面比页面底色高一级，因为原来的 45% 弱化色在普通显示器上难以辨认。在 FUI 界面下，composer 的虚线行分隔线与发送控件保持 6px 净距——原胶囊形态的上移偏移在此被取消。

Web 应用拥有唯一一份 Tailwind utility 构建以及 Space Mono 400 和 700 资源。根节点外的临时探针已经移除；所有可见 f-ui 组件都属于常规运行时外壳。

## 验证

布局测试覆盖命令栏、状态徽标、跳转链接、保留的列行为与窄窗口让步。侧栏、Workspace、对话和基础控件的定向测试覆盖共用功能实现。Web 生产构建证明 utility 扫描能到达 vendored 组件源文件并生成字体资源。在 1440×900 和 375×812 下执行组装后的 `fui` profile 检查，验证 FUI 模块成功加载、窄侧栏仍保留中心列、文档没有水平溢出，且浏览器控制台没有错误。

## 考虑过的替代方案

- **把 token 桥接作为完整迁移**：否决，因为配色替换无法表达目标组件库的层级、方形交互状态、边框标题、命令栏、密度与字体。
- **保留 `#root` 外的 f-ui 构建探针**：否决，因为它绕过运行时 plugin 组合，除 CSS 生成外无法证明任何应用行为。
- **把 f-ui 打进每个消费它的客户端 plugin**：否决，因为每个组合包都会携带一份展示模块副本，并可能把第二套面向 React 的依赖图带入 loader。静态模块表本就用于共享浏览器单例。
- **创建独立 FUI 前端应用**：否决，因为产品行为与功能花名册保持共用时，这会重复 Web 外壳、loader 启动、传输和前端发布路径。

## 后果

- 运行时客户端组合包能够导入 f-ui 组件，是因为 Web 外壳提供了该库。其他客户端平台在挂载这些组合包前必须增加等效平台模块。
- FUI 几何有意同时存在于带作用域的功能 CSS 和根布局中。修改共用功能标记时，必须保持原界面与 `data-fui-surface` 界面都能正确显示。
- Space Mono 覆盖拉丁文本和界面符号，但不包含 CJK 字形。FUI 字体栈将中文文本交给平台等宽字体和 CJK 回退字体。
- FUI profile 仍是原应用之上的组合变化，而不是第二套产品实现。
