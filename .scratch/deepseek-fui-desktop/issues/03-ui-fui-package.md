# 03 — ui-fui 组件库包落地

**What to build:** 把 f-ui 作为一个纯库包纳入 workspace，让其他 client 包能引用它的组件。f-ui 走的是复制粘贴分发（组件自足单文件、互不 import、只依赖一个 `cn` 工具），所以这里落的是源码而非 npm 依赖 —— 拷进来之后就是本项目自己的代码。

定位对标官方的 `ui-primitives`：纯库，不注册 cordis 服务，不做任何组装决策。

**Blocked by:** 02

**Status:** done

- [x] 新增的组件库包在 workspace 中可被其他 client 包解析和引用（`@deepseek-ai/dsh-client-ui-fui`，已注册 tsconfig paths 与 client 聚合 references）
- [x] fui 组件源码（38 个）、`cn` 工具、设计 token 样式表均已入库，MIT 归属记于 README
- [x] 该包通过项目现有的 typecheck 与 lint
- [x] 渲染 smoke test 7 项全过；`test:gui` 273 文件 / 3764 测试零回归
- [x] 该包不注册任何 cordis 服务、不含组装决策（invariant 伴生入口为空实现）
- [x] 记录 fui 上游版本 `54efcd7`，README 写明 re-sync 步骤

## 实施中发现的约束（原工单未预见）

上游对新包的强制项比预想多，且分散在多个 gate：

- **每个 client 包都要有 `src/invariant.ts` 伴生入口**，即使是纯库（`ui-slots` 就是空实现的先例）
- **`files` 数组被 gate 固定**，多一项都不行。样式表要发布必须走 `lib/styles` 并在 `scripts/check-workspace-constraints.ts` 的 `packageFileExtras` 里登记 —— `ui-theme` 是唯一先例
- **`tsconfig.json` 不能带注释**，`verify-package-invariants` 用严格 `JSON.parse` 读它
- **README 的短式 Model Experience 要在 `verify-package-readme-model-experience.ts` 的白名单里登记**，否则必须写完整的 context blocks

## 两处 vendor 边界（已记入包 README）

- `noUncheckedIndexedAccess: false` 仅限本包 —— `wireframe.tsx` 一个文件在该 flag 下报 104 错（其余 37 个组件合计 3 个），关掉它才能让 re-sync 保持"纯文件复制"
- `.oxlintrc.json` 忽略 `src/components/**` 与 `src/lib/**`，与既有的 `vendor/**` 同一条理由

`strict` 找到的 3 个真实错误是就地修的，没有用配置绕过：两处 `RefObject.current` 在 React 18 类型下只读，
经 `MutableRefObject` 窄化；一处 `exactOptionalPropertyTypes` 下显式传 `undefined`，把目标 prop 类型放宽。
