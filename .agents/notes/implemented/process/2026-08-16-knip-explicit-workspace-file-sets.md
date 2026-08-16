# Agent Note: Knip workspace entries pin their file sets so hygiene passes on a built tree

Status: implemented

English | [中文](2026-08-16-knip-explicit-workspace-file-sets.zh.md)

## Problem

`pnpm run hygiene` chains the rescope check, knip, publint, and the verify-* gates, and `verify-built-package-invariants` consumes built `lib/`, so hygiene must pass on a tree where a build has run. Two defects broke that. First, a `knip.json` workspace entry opts out of the `packages/*/*` wildcard entirely: keys it omits — `project` included — fall back to knip's defaults rather than inheriting the wildcard's `src`/`tests` patterns. The four entries that set only `ignoreDependencies` (`bundle/base`, `bundle/headless`, `bundle/web-app`, `host/directory-picker-auto`) therefore scanned with the default project glob, which sweeps the package's built `lib/types` into the report as unused files. The report appears only after a local build, which made it look like stale residue and blocked hygiene for anyone who had built. Second, the desktop/fui work added workspaces knip had no model of: `apps/desktop`, whose Electron main/preload and packaging hooks are reached through tsdown and electron-builder indirection knip cannot follow, and `apps/desktop/runtime`, a dependency-only deploy root whose 200+ declared dependencies exist for the packager, not for imports — knip reported every one as unused.

## Decision

Every `knip.json` workspace entry now declares its `entry` and `project` explicitly, mirroring the wildcard's `src`/`tests` conventions, so a built `lib/` never enters the scan regardless of clean state; the four `ignoreDependencies`-only entries gained both keys.

The new workspaces are modelled directly. `apps/desktop` gets an entry listing the files reached only through tooling indirection — `src/main.ts` and `src/preload.ts` (tsdown and the Electron `main` field) and `scripts/verify-packaged-runtime.ts` (the electron-builder `afterPack` hook). `apps/desktop/runtime` joins `ignoreWorkspaces` next to `python/sdk-runtime`, the other dependency-only deploy root. `apps/web` ignores the dependencies its CSS references by `@import` (`@deepseek-ai/dsh-client-ui-fui`, `@deepseek-ai/dsh-client-ui-fui-surface`, `tailwindcss`), the same invisibility class as its existing bundler-only ignores.

`scripts/clean.ts` removes `apps/desktop/{lib,dist,runtime-host}` explicitly. The Electron shell stays out of the root project-reference graph, so the reference walk never discovers its outputs; `apps/desktop/runtime` is tracked (a workspace manifest) and must survive clean.

Dependencies knip proved unreferenced were deleted rather than ignored: `@deepseek-ai/dsh-api-gateway` from `ui-settings-runtime-updater` (peer + dev + `dsh.client.inject` + tsconfig reference — the plugin actually mounts `@deepseek-ai/dsh-host-runtime-updater/remote`), `@deepseek-ai/dsh-client-ui-slots` from `cordis-client-runner` (peer + dev + a stale tsconfig reference), `react-dom` and `@types/react-dom` from `ui-fui` (the tests resolve `react-dom` as `@testing-library/react`'s peer, not through this manifest), and the internally-used-only `WindowCloseEvent` interface lost its `export`.

## Alternatives considered

**Ignore `lib/` with one global glob.** Rejected because `packages/client/ui-fui/src/lib/` is source, not build output (`.gitignore` excepts it from the `lib/` rule for exactly this reason); a global `**/lib/**` ignore would exempt that source from analysis. Per-workspace `project` patterns name the real source sets precisely.

**Run knip only on clean trees, or clean inside hygiene.** Rejected because hygiene already requires built `lib/` for `verify-built-package-invariants`, and a gate whose verdict depends on whether the developer just built is flaky for exactly the local runs it serves.

**Ignore the unreferenced dependencies in knip config instead of deleting them.** Rejected per the current-owner-and-need rule: an ignore entry blesses dead manifest surface that publication then carries, and the upstream `dsh.client.inject` edge on a service the plugin never reads misinforms preflight and HMR diffing.

## Consequences

- `pnpm run hygiene` passes on clean and built trees alike, and the desktop deploy root no longer drowns the knip report in false unused-dependency lines.
- Every knip workspace entry states its file set in full, so adding a key to an entry no longer silently changes which files knip scans; the cost is that new workspace entries must copy the explicit `entry`/`project` boilerplate, and CSS-only or tooling-only references still need hand-listed ignores.
- Four manifests drop dead dependency surface and the lockfile shrinks accordingly.
- Verification: full build plus the affected suites (`ui-fui`, `ui-settings-runtime-updater`, `cordis-client-runner`, `apps/desktop`, `clean.spec.ts` including the new desktop-output case) pass, and `hygiene` and `lint` are green on the built tree.

## Related

- [Rescope vendored Cordis into @deepseek-ai](2026-08-10-vendor-package-rescope.md) — its `GENERIC_SKIPS` gained the event-name and locale-namespace exemptions in the same repair.
- [Mechanical quality gates over prose guidelines](2026-06-11-quality-gates.md) — the gate policy this repair keeps honest on built trees.
