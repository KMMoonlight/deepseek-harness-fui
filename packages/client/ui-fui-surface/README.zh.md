# @deepseek-ai/dsh-client-ui-fui-surface

[English](README.md) | 中文

FUI 界面的页面声明。其浏览器端会为文档添加 `data-fui-surface`，并加载别名桥接表，把 [`ui-theme`](../ui-theme/README.md) 的 `--dsw-alias-*` 层重新指向 [`ui-fui`](../ui-fui/README.md) 的 `--fui-*` token。

## 为什么它是配色基础

`ui-theme` 拥有语义别名层，[样式参考](../../../docs/web-styling.md)要求每个功能包使用这些别名并禁止字面颜色。f-ui 在自身一侧执行对称规则，其测试会按文件拒绝任何字面颜色。两套使用不同前缀且约束明确的变量系统允许系统把一侧重新指向另一侧，从而无需编辑每个组件，就能为对话、轨迹、工具卡片、侧栏和设置等三十多个原有功能包替换配色。

ui-theme 使用两类 token，两类都必须桥接：`--dsw-alias-*` 语义层，以及命名具体界面的少量 `--dsw-specific-*` token，例如侧栏填充、输入区、菜单和气泡。遗漏第二类会在 FUI 底色上留下明亮的原界面，因此[覆盖测试](tests/bridge-coverage.client.spec.ts)会拒绝未映射 token、过期配置项，或任何未解析为 `--fui-*` token 的映射。

该桥接表只拥有配色。FUI 布局和带作用域的功能样式拥有密度、方形几何、状态栏、焦点与选择状态，以及终端字体。拆分这些职责后，原 `web` profile 能与 FUI profile 共用前端构建，又不会继承 FUI 几何。

为使后续新增保持一致，角色映射遵循以下规则：深度从 `bg-base` 逐级升至 layer 1..3；覆盖层和浮动界面使用不透明的 `panel-solid`，而不是会与下层合成的半透明 `panel-bg`；规则线从 `border-l1..l4` 映射到 f-ui 线条色阶；由于 f-ui 的文字层级较少，四级文字角色收敛为两级；状态依次映射为 error→danger、warn→warn、success→ok、business→accent，并使用各 tone 自己的 `-soft`/`-line` 派生值。

## 为什么使用属性而不是导入

原界面与 FUI 界面共用一份前端构建，因此声明 `:root` 的样式表也会修改 `dsh web`。这里的全部规则都限定在 `body[data-fui-surface]` 下，且只有 FUI 花名册挂载的本包浏览器端会设置该属性。这个属性也会激活 vendored token 表自身的页面规则，绘制底色、文字颜色、等宽字体和坐标网格。

## 模型体验

无。该包只向浏览器客户端贡献文档属性和自定义属性表；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **仅有单一深色界面**：f-ui 只提供 `cyan` 主题，因此桥接表没有浅色变体。ui-theme 的明暗偏好仍会解析并驱动原界面，但 FUI 界面的两个分支都会落在同一配色上。
- **遮罩颜色使用字面量**：四个 `bg-mask-*` 角色需要在 FUI 底色上叠加 alpha，而 f-ui 没有提供预先派生的遮罩 tone，因此这些值使用基于已知底色的 `rgba()`。修改底色不会同步更新它们。
- **没有对比度门禁**：运行界面的测量结果中，正文与底色的对比度为 11.5–12.1:1，超过 WCAG AA，但没有检查逐角色比例的门禁，因此未来修改 token 可能降低可读性而不触发构建失败。
