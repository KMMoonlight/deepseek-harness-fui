# 002 — Tailwind 在应用层构建一次，并破例引入

**日期:** 2026-08-14
**关联工单:** 05
**状态:** 已实施

## 结论

FUI 的 utility 样式表由 Vite 在**应用层构建一次**，产出一张全局样式表；client 插件包不各自跑 CSS 构建，只输出类名字符串。这需要在本 fork 中破除上游"禁止 Tailwind"的约定。

## 背景：为什么这是一条约定而不是技术限制

上游在两处明文禁止：`docs/web-styling.md` 写 "Use CSS Modules and `clsx`; do not add a component library or Tailwind"，`packages/client/AGENTS.md` 复述同一条。

但**没有任何自动化 gate 强制它** —— `scripts/`、`.oxlintrc.json`、`ui-theme/` 全部零命中。所以这是一条评审约定，破除它不需要关闭任何检查，只需要留下这份记录，避免后来者当成疏忽给"修"回去。

上游的 feature 包仍然遵守原约定：它们通过 CSS Modules 消费 `--dsw-alias-*`。破例只覆盖 vendored 的 f-ui 组件与本 fork 新增的 FUI 呈现层包。

## 为什么在应用层构建，而不是每个插件各建一份

dsh 的 client 插件是 tsdown 的 closure-factory bundle，**从不进入 Vite 的模块图** —— 它们在运行时通过 client module system 以自己的 bundle 到达。给每个插件接 Tailwind 的 PostCSS 链既繁琐又会产出重复的 utility。

而 utility CSS 本质是全局的：类名只是字符串，样式表一张就够，插件运行时渲染出的 DOM 照样命中。所以正确的形态是应用层单次构建 + `@source` 把 content 扫描扩到插件源码目录。

已验证扫描确实跨包生效：产物里出现了 `var(--fui-warn-line)`，而探针只用了 primary 变体 —— 这个 utility 只可能来自 ui-fui 的组件源码。增量方向也验证过：新用一个此前未出现的类会生成，移除后会被清除。

## 两处必须的收敛，否则会污染原生 surface

本 fork 让 `dsh web` 与 `dsh --profile fui` **共用一份前端产物**（见工单 04 的设计偏离），所以任何全局 CSS 都会同时打到两个 surface 上。实测踩到两个：

**1. 不引入 Tailwind preflight。** `@import 'tailwindcss'` 会带进全局元素 reset，与 ui-theme 自己的 base 表打架 —— 现象是原生 UI 的排版整个变样。改为只引 theme 与 utilities 两层：

```css
@layer theme, base, components, utilities;
@import 'tailwindcss/theme.css' layer(theme);
@import 'tailwindcss/utilities.css' layer(utilities);
```

**2. vendored token 表对 `body` 的接管改为按需。** 上游 `fui.css` 里有一条无条件的 `body { background/color/font-family/背景网格 }`。这条规则本身是想要的，但"FUI surface 接管整个页面"是布局包在 FUI profile 上的决定，不该由共用样式表强加给两个 surface。

改法是把选择器收敛为 `body[data-fui-surface]`，**这是 vendored 文件中唯一的一处编辑**，已在文件内和包 README 标注，re-sync 后需要重新施加。

之所以不用 CSS 侧的 `revert-layer` 去抵消：dsh 根本没有在 `body` 上声明 font-family，没有可回退的目标，实测无效。

## 影响

- 每个会输出 FUI utility 类的包都必须登记进 `apps/web/src/fui.css` 的 `@source` 列表，漏登记的表现是样式被清除、UI 看起来没上样式
- `apps/web` 现在依赖 `@deepseek-ai/dsh-client-ui-fui`，并在 Vite alias 中指向其 src（纯库包的既有惯例）
- 上游合并 `docs/web-styling.md` 或 `packages/client/AGENTS.md` 时会看到 Tailwind 禁令，以本记录为准
