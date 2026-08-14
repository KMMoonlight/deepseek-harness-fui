# @deepseek-ai/dsh-client-ui-fui-layout

[English](README.md) | 中文

FUI 界面的应用框架。它 fork 自 [`ui-layout`](../ui-layout/README.md)，由 `fui` profile 替代原布局挂载。两个包声明相同的子 slot，且 `root` 为 single-kind，因此该 profile 会先禁用原布局配置项，再挂载本包。

## FUI 外壳

该框架在应用列外拥有三行控制外壳：顶部命令栏显示产品信息和实时 Session 状态，中间一行承载侧栏、对话区和详情区，底部状态栏显示当前界面与 Workspace 上下文。中心界面使用 f-ui 网格、钢蓝色细线、方形缩放控件，以及[别名桥接](../ui-fui-surface/README.md)提供的目标配色。跳转链接指向中心列；在窄视口下，命令栏和状态栏仍然保留，但会收起次要标签。

根注册项会绑定 `fui-layout` locale namespace，因此命令栏、状态栏与无障碍文案会跟随当前客户端 locale。`DSH` 和 `DEEPSEEK HARNESS` 等产品标记保持为字面文本。

`Badge` 和 `ScreenEffects` 来自 [`ui-fui`](../ui-fui/README.md)。浏览器外壳通过 `PLATFORM_MODULES` 共享该库，因此运行时客户端组合包与应用使用同一个 React 和 f-ui 模块实例，不会再打包一份副本。

## 保留的布局行为

列宽计算、拖动控件、窄窗口让步链、`ctx.layout` 面板几何服务和主题展示转换器均保留 `ui-layout` 的行为。该 plugin 注册到运行时拥有的 `root` slot，并声明 `sidebar`、`conversation`、`details` 和 `conversation.empty`。侧栏缩放边界为不可见命中区，详情区则保留可见的方形控件。只有详情区会在让步期间缩小并自动关闭。关闭后的侧栏保留 56px 控制轨道，详情区则收至零宽。

主题展示转换器把已解析的 `ctx.theme` 快照投影到文档，包括原生配色方案、当前 body 主题属性、内联别名 token，以及一个由本包拥有的 theme-color 元数据节点。dispose 时会移除这些全局写入。

AppFrame 始终挂载对话列和详情列；已连接的 Session 通过 `SessionProvider` 渲染。瞬态布局 store 以侧栏默认宽度和关闭的详情区启动，且不会读写 `localStorage`。Hero 等未选中状态也会把详情区渲染为零宽，但不修改存储的首选值。AppFrame 会跨这些状态保留最后一个非空白 Session id：首个 Session 保持详情关闭；显式详情操作按默认宽度打开；返回同一 Session 会恢复未变的宽度；选择其他 Session 会在绘制前关闭详情。对话 owner share 为空，侧栏 owner share 仅包含 `collapsed` 和 `width`；注册项通过标准 hook 获取业务数据，并从各自的 inject 接口获取 action。

`/client` 导出 plugin 主体（`apply`/`inject`）、`LayoutController` 和 owner-share interface。AppFrame、面板 store 与让步解析器仍为包内实现。

## 模型体验

无。布局外壳管理浏览器查看状态；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **面板几何为瞬态**：重新加载会恢复侧栏默认宽度并关闭详情区；在不同 Session id 之间切换也会关闭详情区并忘记拖动后的宽度，而未选中界面会把详情区渲染为零宽，但不会修改几何状态。
- **让步链的自动关闭只派生零宽结果，不修改首选宽度**：窗口重新变宽时面板会恢复；消费者不得把存储的详情宽度当作实际渲染值。
- **挤压重排时不保留滚动锚点**：布局变化可能移动读者的视口位置。
