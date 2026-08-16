# Agent Note: knip workspace 条目显式钉住文件集合，hygiene 在构建过的树上也能通过

Status: implemented

[English](2026-08-16-knip-explicit-workspace-file-sets.md) | 中文

## Problem

`pnpm run hygiene` 串联 rescope 检查、knip、publint 和各 verify-* 门，而 `verify-built-package-invariants` 消费构建出的 `lib/`，所以 hygiene 必须在跑过构建的树上也能通过。两个缺陷破坏了这一点。其一，`knip.json` 里一个 workspace 条目一旦存在，就整体脱离 `packages/*/*` 通配：它没写的键——包括 `project`——回落到 knip 默认值，而不是继承通配的 `src`/`tests` 模式。那四个只写了 `ignoreDependencies` 的条目（`bundle/base`、`bundle/headless`、`bundle/web-app`、`host/directory-picker-auto`）因此用默认 project glob 扫描，把包里构建出的 `lib/types` 扫进报告、标成 unused files。这份报告只在本地构建过之后出现，看起来像陈年残留，并且会挡住任何刚构建过的人跑 hygiene。其二，desktop/fui 工作新增了 knip 完全不认识的 workspace：`apps/desktop` 的 Electron main/preload 和打包钩子要经 tsdown、electron-builder 间接到达，knip 跟不上；`apps/desktop/runtime` 是个只声明依赖的部署根，200 多个依赖是给打包器用的、不是给 import 用的——knip 把它们逐条报成未使用。

## Decision

`knip.json` 的每个 workspace 条目现在都显式声明自己的 `entry` 和 `project`，沿用通配的 `src`/`tests` 约定，于是无论树是否干净，构建出的 `lib/` 都不会进入扫描；那四个只写 `ignoreDependencies` 的条目补上了这两个键。

新 workspace 直接建模。`apps/desktop` 的 entry 列出只能经工具链间接到达的文件——`src/main.ts`、`src/preload.ts`（tsdown 与 Electron 的 `main` 字段）和 `scripts/verify-packaged-runtime.ts`（electron-builder 的 `afterPack` 钩子）。`apps/desktop/runtime` 加入 `ignoreWorkspaces`，排在另一个只声明依赖的部署根 `python/sdk-runtime` 旁边。`apps/web` 豁免它的 CSS 以 `@import` 引用的依赖（`@deepseek-ai/dsh-client-ui-fui`、`@deepseek-ai/dsh-client-ui-fui-surface`、`tailwindcss`），与它既有的一组打包器专用豁免同属一类不可见引用。

`scripts/clean.ts` 显式删除 `apps/desktop/{lib,dist,runtime-host}`。Electron shell 不在根 project-reference 图里，reference 遍历永远发现不了它的产物；`apps/desktop/runtime` 是受跟踪的（一个 workspace manifest），clean 必须保留它。

knip 证实无引用的依赖一律删除而不是豁免：从 `ui-settings-runtime-updater` 删掉 `@deepseek-ai/dsh-api-gateway`（peer + dev + `dsh.client.inject` + tsconfig 引用——该插件实际挂载的是 `@deepseek-ai/dsh-host-runtime-updater/remote`）；从 `cordis-client-runner` 删掉 `@deepseek-ai/dsh-client-ui-slots`（peer + dev + 一条过期 tsconfig 引用）；从 `ui-fui` 删掉 `react-dom` 与 `@types/react-dom`（测试里的 `react-dom` 是作为 `@testing-library/react` 的 peer 解析的，不经过本 manifest）；只在本文件内使用的 `WindowCloseEvent` 接口去掉了 `export`。

## Alternatives considered

**用一个全局 glob 忽略 `lib/`。** 否决：`packages/client/ui-fui/src/lib/` 是源码不是构建产物（`.gitignore` 正是为此把它从 `lib/` 规则里例外出去）；全局 `**/lib/**` 忽略会把那部分源码排除在分析之外。逐 workspace 的 `project` 模式才能精确点名真实的源码集合。

**只在干净树上跑 knip，或在 hygiene 里先 clean。** 否决：hygiene 本来就要求构建出的 `lib/` 供 `verify-built-package-invariants` 使用；一个结论取决于开发者刚没刚构建的门，对它最该服务的本地运行来说恰好是 flaky 的。

**把无引用依赖写进 knip 豁免而不是删除。** 否决，依据「每个抽象要有现任 owner 和现实需要」的规则：豁免条目是在给死掉的 manifest 表面背书，发布时会原样带出去；而 `dsh.client.inject` 里挂着一条插件从不读取的服务边，会误导 preflight 展示和 HMR diff。

## Consequences

- `pnpm run hygiene` 在干净树和构建过的树上都通过；desktop 部署根不再用成百上千条误报的未使用依赖淹没 knip 报告。
- 每个 knip workspace 条目完整声明自己的文件集合：给条目加一个键不会再悄悄改变 knip 扫描哪些文件。代价是新条目要照抄这份显式 `entry`/`project` 样板，CSS 或工具链独有的引用仍需手工豁免。
- 四个 manifest 删掉死依赖表面，lockfile 相应缩小。
- 验证：全量构建加受影响测试套件（`ui-fui`、`ui-settings-runtime-updater`、`cordis-client-runner`、`apps/desktop`，以及含新增 desktop 产物用例的 `clean.spec.ts`）全部通过，`hygiene` 与 `lint` 在构建过的树上全绿。

## Related

- [Rescope vendored Cordis into @deepseek-ai](2026-08-10-vendor-package-rescope.md)——同一次修复中，它的 `GENERIC_SKIPS` 新增了事件名与 locale 命名空间豁免。
- [Mechanical quality gates over prose guidelines](2026-06-11-quality-gates.md)——本次修复让这套质量门策略在构建过的树上保持诚实。
