# Agent Note: FUI components are a shared runtime client module

Status: implemented

English | [中文](2026-08-14-fui-runtime-client-surface.zh.md)

## Problem

The FUI profile changed the stock application's color tokens and replaced the application frame with a nearly identical fork, while one f-ui component rendered in a separate probe outside the shell root. That arrangement proved the Tailwind pipeline but did not make f-ui part of the runtime client composition. The sidebar, conversation shell, composer, menus, and status presentation retained the stock visual grammar, and a runtime plugin could not import `@deepseek-ai/dsh-client-ui-fui` because the browser module table did not provide it.

The stock and FUI profiles share one frontend dist. A deeper FUI application therefore has to preserve the plugin roster, React singleton, slot ownership, and stock profile while allowing runtime client bundles to use the vendored presentation library.

## Decision

`@deepseek-ai/dsh-client-ui-fui` is a browser platform module. [`PLATFORM_MODULES`](../../../../packages/client/web/README.md) drives the static seed table and client bundle externals, so runtime presentation plugins import the same f-ui and React instances that the application owns. The FUI layout imports `Badge` and `ScreenEffects` from that module instead of bundling them.

The [`ui-fui-layout`](../../../../packages/client/ui-fui-layout/README.md) root owns an upper command rail, a lower surface status rail, the f-ui grid, screen effects, and narrow-window reductions. It preserves the existing slot tree, column solver, drag behavior, details lifetime, and theme presenter. Feature packages retain their behavior and use `body[data-fui-surface]` scoped rules for FUI density, square controls, inverted selection, and terminal typography. Those rules cover the Settings shell and its General, Models, Agent preset, configurable plugin, and plugin inventory pages as well as the primary workspace. The stock profile does not set that attribute and retains its existing geometry.

The Web application owns the one Tailwind utility build and the Space Mono 400 and 700 assets. The temporary out-of-root probe is absent; every visible f-ui component is part of the ordinary runtime shell.

## Verification

The layout specs exercise the command rail, status badge, skip link, preserved column behavior, and narrow concession. Focused sidebar, Workspace, conversation, and primitive specs cover the shared feature implementations. The production Web build proves the utility scan reaches the vendored component source and emits the font assets. An assembled `fui` profile check at 1440×900 and 375×812 verifies the FUI module loads, the narrow rail retains the center column, the document has no horizontal overflow, and the browser console reports no errors.

## Alternatives considered

- **Keep the token bridge as the complete migration**: rejected because color substitution cannot express the target library's hierarchy, square interaction states, border titles, command rails, density, or typography.
- **Keep the f-ui build probe outside `#root`**: rejected because it bypasses the runtime plugin composition and proves no application behavior beyond CSS generation.
- **Bundle f-ui into each consuming client plugin**: rejected because each bundle would carry a second presentation module and could pull a second React-facing dependency graph into the loader. The static module table already exists to share browser singletons.
- **Create a separate FUI frontend application**: rejected because it would duplicate the Web shell, loader boot, transport, and frontend publication path while the product behavior and feature roster remain shared.

## Consequences

- Runtime client bundles may import f-ui components only because the Web shell seeds the library. Other client platforms must add an equivalent platform module before mounting those bundles.
- FUI geometry is intentionally expressed in scoped feature CSS as well as the root layout. Changes to shared feature markup must keep both the stock and `data-fui-surface` presentations valid.
- Space Mono covers Latin text and UI symbols but not CJK glyphs. The FUI font stack delegates Chinese text to the platform monospace and CJK fallbacks.
- The FUI profile remains a composition change over the stock application rather than a second product implementation.
