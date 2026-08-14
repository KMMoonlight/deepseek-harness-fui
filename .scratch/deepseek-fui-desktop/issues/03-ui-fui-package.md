# 03 — ui-fui 组件库包落地

**What to build:** 把 f-ui 作为一个纯库包纳入 workspace，让其他 client 包能引用它的组件。f-ui 走的是复制粘贴分发（组件自足单文件、互不 import、只依赖一个 `cn` 工具），所以这里落的是源码而非 npm 依赖 —— 拷进来之后就是本项目自己的代码。

定位对标官方的 `ui-primitives`：纯库，不注册 cordis 服务，不做任何组装决策。

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] 新增的组件库包在 workspace 中可被其他 client 包解析和引用
- [ ] fui 组件源码、`cn` 工具、设计 token 样式表均已入库，并保留其 MIT 归属
- [ ] 该包通过项目现有的 typecheck 与 lint
- [ ] 至少一个组件有渲染 smoke test 并通过
- [ ] 该包不注册任何 cordis 服务、不含组装决策
- [ ] 记录 fui 上游版本，便于日后同步组件更新
