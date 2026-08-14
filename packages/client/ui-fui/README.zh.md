# @deepseek-ai/dsh-client-ui-fui

[English](README.md) | 中文

采用 FUI（Fictional User Interface）风格的 React 组件：深海军蓝底色、钢蓝色细线和青绿色高亮。代码依据 MIT 许可证从 [f-ui](https://github.com/KMMoonlight/fui) vendored 到本仓库。它与 [`ui-primitives`](../ui-primitives/README.md) 同级，是一个纯组件库，不依赖 Cordis，不提供 plugin、服务或 slot 注册。

## 为什么 vendored 而不是声明依赖

f-ui 采用与 shadcn 相同的复制分发方式：上游没有发布 npm 包，其 `package.json` 为 `private: true`，安装器会把组件源文件写入使用方项目。每个组件都是只导入 `cn` 的独立模块，组件之间不存在交叉导入；导入时会验证这一点，而不是依赖假设。因此，重新同步只需复制普通文件，这也是 `src/index.ts` 导出整个模块而不是逐一列出 112 个符号的原因。

这里 vendored 的上游版本为 `54efcd7`。重新同步时复制 `src/components/`、`src/lib/cn.ts` 和 `src/theme/fui.css`，然后重新执行 fork 决策 001 记录的 React 兼容性扫描。上游面向 React 19，而本仓库使用 React 18；当前全部组件都只使用 React 18 支持的接口。

## 样式约定

组件使用 Tailwind utility class，并通过 [`src/styles/fui.css`](src/styles/fui.css) 中定义的 `--fui-*` 自定义属性取值。该 token 表发布到 `lib/styles/`，消费者通过 `@deepseek-ai/dsh-client-ui-fui/styles/fui.css` 导入。这里有两项与其他 `packages/client/*` 包不同的约定：

- **本包有意偏离 [docs/web-styling.md](../../../docs/web-styling.md)**：该文档禁止功能包使用 Tailwind 和组件库。那条规则约束的是通过 CSS Modules 消费 `--dsw-alias-*` 的功能组件；本包是 vendored 展示组件库，依据 fork 决策获得豁免。本仓库的功能包仍遵守原规则。
- **组件不导入 CSS**：utility 样式表只在应用层生成一次，且 Tailwind 内容扫描必须覆盖 `src/components/`。本包只发布 token 表；如果应用没有执行该应用层构建，仅导入 `./styles/fui.css` 会得到自定义属性，却没有使用它们的 utility。

组件源文件中不出现字面颜色。每种 tone 都通过 `var(--fui-<tone>-{soft,line,line-strong})` 解析，因此主题覆盖只需修改一个自定义属性块，不必接触组件。

## Vendor 范围

只有 vendored 源文件放宽了两项仓库级设置，原因相同：上游在更宽松的配置下构建；若强行让其写法满足本仓库规则，就会永久 fork 这些文件，并破坏本包依赖的普通文件复制同步方式。

- **本包的 `tsconfig.json` 设置 `noUncheckedIndexedAccess: false`**。该文件必须保持无注释，因为 `scripts/verify-package-invariants.ts` 会按严格 JSON 解析。`wireframe.tsx` 的向量数学渲染器在紧密循环中索引数组；仅这个文件在启用该选项时就产生 104 个错误，而其余 37 个组件合计只有 3 个。其他严格设置仍保持启用，尤其是 `exactOptionalPropertyTypes`。
- **`.oxlintrc.json` 忽略 `src/components/**` 与 `src/lib/**`**。它们与既有的 `vendor/**` 配置项原因一致：vendored 源文件保留上游风格和写法。放宽上述类型选项后，上游的部分 optional chaining 也会被 lint 判断为不必要。

`strict` 找到的三个真实类型错误通过局部修改解决，没有通过配置隐藏：React 18 类型中的 `RefObject.current` 为只读，因此 `dropdown-menu.tsx` 与 `select.tsx` 的 `assignRef` 会先收窄为 `MutableRefObject`；`notification-stack.tsx` 则把一个可选回调属性显式扩展为接受 `undefined`。`src/components/` 与 `src/lib/` 之外的代码，包括 barrel、invariant 配套实现和测试，仍执行完整 lint 与严格类型检查。

`src/lib/cn.ts` 包含一处本地 JSDoc 和返回类型标注，因为 barrel 会把 `cn` 暴露为包 API，`verify-export-jsdoc` 也会检查该导出。如果重新同步时覆盖这段注释，文档门禁会直接失败，而不会静默丢失公开说明。

## 模型体验

无。该包只向浏览器客户端贡献展示组件；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；该包既不组装也不发送提供方请求。

## 已知限制与暂缓事项

- **仅有单一深色主题**：上游只提供 `cyan` 主题，没有浅色变体。需要明暗主题的消费者必须自行编写第二个自定义属性块。
- **Utility 依赖应用层构建**：未对组件源文件执行 Tailwind 的应用无法使用本包，且该耦合只有在界面渲染为无样式状态时才会显现。
- **Vendored 代码会漂移**：没有机制检测上游 f-ui 的变化；重新同步为手动操作，React 接口检查也依赖人工步骤，而非门禁。
- **字体由应用拥有**：本包定义 `data-fui-font` 字体栈，但不提供字体资源。Web 应用提供 Space Mono 400 和 700 作为默认 FUI 字体；其他消费者必须提供其所选字体资源。Space Mono 不包含 CJK 字形，因此中文文本使用 `--fui-font` 中的平台回退字体。
