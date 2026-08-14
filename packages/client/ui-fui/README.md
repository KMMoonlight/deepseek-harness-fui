# @deepseek-ai/dsh-client-ui-fui

English | [中文](README.zh.md)

FUI (Fictional User Interface) styled React components — dark navy ground, thin steel-blue rules, teal highlights — vendored from [f-ui](https://github.com/KMMoonlight/fui) under MIT. A pure library in the same tier as [`ui-primitives`](../ui-primitives/README.md): zero cordis, no plugin, no service, no slot registration.

## Why vendored rather than depended on

f-ui distributes by copy, shadcn style: it publishes no npm package (`private: true` upstream) and its own installer writes component sources into the consuming project. Each component is a self-contained module importing nothing but `cn`, and cross-component imports do not exist — verified on import, not assumed. The re-sync path is therefore a plain file copy, which is why `src/index.ts` re-exports whole modules instead of naming all 112 symbols individually.

Upstream revision vendored here: `54efcd7`. Re-syncing means recopying `src/components/`, `src/lib/cn.ts`, and `src/theme/fui.css`, then re-running the React-compatibility scan recorded in the fork's decision 001 — upstream targets React 19 while this repository is on React 18, and today every component stays inside the React 18 surface.

## Styling contract

Presentation is Tailwind utility classes over the `--fui-*` custom properties defined in [`src/styles/fui.css`](src/styles/fui.css), published to `lib/styles/` and imported by consumers as `@deepseek-ai/dsh-client-ui-fui/styles/fui.css`. Two consequences that differ from every other `packages/client/*` package:

- **This package deliberately departs from [docs/web-styling.md](../../../docs/web-styling.md)**, which bans Tailwind and component libraries in feature packages. That rule governs feature components consuming `--dsw-alias-*` through CSS Modules; this is a vendored presentation library and is exempt by fork decision. Feature packages in this repository still follow the upstream rule.
- **No component imports CSS.** The utility stylesheet is generated once at the application layer, whose Tailwind content scan must cover `src/components/`. This package ships the token sheet and nothing else; importing `./styles/fui.css` without that application-layer build yields custom properties with no utilities to consume them.

Colour literals never appear in component source — every tone resolves through `var(--fui-<tone>-{soft,line,line-strong})`, so a theme override is one custom-property block and touches no component.

## The vendor boundary

Two repository-wide settings are relaxed for the vendored sources only, both for the same reason: upstream builds under looser configuration, and asserting through its idioms here would fork the files permanently and break the plain-file-copy re-sync this package is built around.

- **`noUncheckedIndexedAccess: false`** in this package's `tsconfig.json` (which stays comment-free — `scripts/verify-package-invariants.ts` parses it as strict JSON). The vector-math renderer in `wireframe.tsx` indexes arrays in tight loops; that one file produced 104 errors under the flag, against 3 in the other 37 components combined. Everything else stays strict — `exactOptionalPropertyTypes` in particular remains on.
- **Lint ignores `src/components/**` and `src/lib/**`** in `.oxlintrc.json`, alongside the existing `vendor/**` entry and for the reason that entry already states: vendored source keeps upstream style and idioms. Note that relaxing the type flag above is itself what makes some of upstream's optional chaining read as unnecessary to the linter.

The three genuine type errors `strict` did find were fixed in place rather than configured away: `RefObject.current` is readonly under React 18 types, so `assignRef` in `dropdown-menu.tsx` and `select.tsx` narrows through `MutableRefObject`; and `notification-stack.tsx` widens one optional callback prop to accept `undefined` explicitly. Code outside `src/components/` and `src/lib/` — this package's barrel, its invariant companion, and its specs — is fully linted and fully strict.

`src/lib/cn.ts` carries one local JSDoc and return annotation because the barrel exposes `cn` as package API and `verify-export-jsdoc` checks that export. A re-sync that overwrites it fails the documentation gate instead of silently dropping the public description.

## Model Experience

None, as this package contributes presentation atoms to the browser client; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Single dark theme** — upstream ships only the `cyan` theme; there is no light variant. A consumer wanting light/dark must author the second custom-property block itself.
- **Utilities depend on an application-layer build** — the package cannot be consumed by an application that does not run Tailwind over its component sources, and that coupling is invisible until the UI renders unstyled.
- **Vendored code drifts** — nothing detects upstream f-ui changes; re-sync is manual and its React-surface check is a human step, not a gate.
- **Fonts are application-owned** — this package defines the `data-fui-font` stacks but ships no font asset. The Web application supplies Space Mono 400 and 700 as the default FUI face; another consumer must provide its selected asset. Space Mono has no CJK glyphs, so Chinese text uses the platform fallback in `--fui-font`.
