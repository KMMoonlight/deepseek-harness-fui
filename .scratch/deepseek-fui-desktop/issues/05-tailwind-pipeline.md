# 05 — Tailwind 构建链路接通

**What to build:** 让 fui 组件在真实运行的应用里带着完整样式渲染。

关键决策：**Tailwind 在应用层构建一次**，扫描范围覆盖全部自有 client 插件的源码，产出一张全局样式表；插件侧只输出类名字符串，各自不跑 CSS 构建。这样绕开了给每个插件的打包链接 Tailwind 的麻烦 —— utility CSS 本来就是全局的，不需要按插件作用域切分。

注意上游的样式约定明确禁止在 feature 包里引入 Tailwind 和组件库。本项目是 fork，可以为自有包破这条例，但需要在决策记录里写明理由，避免后来者误以为是疏忽。

**Blocked by:** 03, 04

**Status:** done —— 一条验收按架构现实调整，见下

- [x] Tailwind 在前端应用层构建，`@source` 覆盖 ui-fui 源码；已验证跨包生效（产物中出现 `var(--fui-warn-line)`，而探针只用 primary 变体，该 utility 只可能来自 ui-fui 组件源码）
- [x] token 表按正确顺序引入，`--fui-primary:#2fe0a8` / `--fui-bg:#060c18` 等变量进入产物
- [x] 探针组件带完整 FUI 样式渲染 —— 描边、配色、字体（`tracking-[0.2em]` → `letter-spacing:.2em`）三项均生效
- [x] **改为验证增量拾取**：新用一个此前未出现的 utility 会被生成，移除后被清除 —— 见下方说明
- [x] 生产构建产物不含未使用样式（抽查 `animate-bounce` / `grid-cols-12` / `backdrop-blur-3xl` 均为 0）
- [x] 破例理由写入决策记录 002

## 验收调整：HMR 那条在本架构下不成立

原验收要求"开发模式下热更新生效，无需重启"。但 `apps/web` **不存在 dev server** —— `vite.config.ts` 里有一个
`rejectStandaloneServe` 插件，在 `command === 'serve'` 时直接抛错，因为裸 Vite 注入不了 `window.__DSH_BOOT__`。
`pnpm run dev:web` 监听的是 client 插件的 bundle，不是应用层。

所以应用层 Tailwind 不存在"热更新"这个场景，改为验证等价且真正要紧的性质：**content 扫描能增量拾取新类**。
双向都验证了（新增→生成，移除→清除）。

## 两处必须的收敛（否则污染原生 surface）

因为两个 surface 共用一份产物，任何全局 CSS 都会同时打到 `dsh web` 上。实测踩到两个，都已修：

1. **不引入 Tailwind preflight** —— 它的全局元素 reset 会和 ui-theme 的 base 表打架，现象是原生 UI 排版整个变样。
   改为只引 `tailwindcss/theme.css` 与 `tailwindcss/utilities.css` 两层。
2. **vendored `fui.css` 的 `body` 规则收敛为 `body[data-fui-surface]`** —— 这是该包中唯一一处 vendor 编辑，
   已在文件内和包 README 标注。先尝试过在应用层用 `revert-layer` 抵消，无效：dsh 根本没在 `body` 上声明
   font-family，没有可回退的目标。

## 另外两个坑

- `apps/web` 导入 workspace 包的源码会撞 `rootDir` —— 必须在其 tsconfig 的 `references` 里加该包，
  否则 tsc 会按 apps/web 的 outDir 去编译被导入的源码，**在 `packages/client/ui-fui/src/` 里漏出 79 个
  `.d.ts` / `.js` / `.map` 产物**。已清理并修正。
- 侧效应 CSS 导入需要 `declare module '*.css' {}` 环境声明，否则 tsc 报 TS2882。
