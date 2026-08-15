# @deepseek-ai/dsh-client-ui-fui-surface

English | [中文](README.zh.md)

The FUI surface claim. Its browser half marks the document with `data-fui-surface` and loads the alias bridge that repoints [`ui-theme`](../ui-theme/README.md)'s `--dsw-alias-*` layer at [`ui-fui`](../ui-fui/README.md)'s `--fui-*` tokens.

## Why this is the color foundation

`ui-theme` owns the semantic alias layer, and [the styling reference](../../../docs/web-styling.md) requires every feature package to consume those aliases and forbids literal colours. f-ui enforces the mirror-image rule on its own side, with a test that fails per file on any colour literal. Two disciplined variable systems under non-colliding prefixes means repointing one at the other re-skins all thirty-odd stock feature packages — conversation, trajectory, tool cards, sidebar, settings — without editing a single component.

ui-theme names tokens in two families, and both must be bridged: the `--dsw-alias-*` semantic layer, and a smaller `--dsw-specific-*` set naming concrete surfaces (sidebar fill, composer input, menus, bubbles). Missing the second family leaves bright stock surfaces on the FUI ground, so [the coverage spec](tests/bridge-coverage.client.spec.ts) fails on an unmapped token, a stale entry, or a mapping that does not resolve to a `--fui-*` token.

The bridge owns color only. The FUI layout and scoped feature styles own density, square geometry, status rails, focus and selection treatment, and terminal typography. Keeping those responsibilities separate lets the stock profile share the same frontend build without inheriting FUI geometry.

Roles map on a few rules, kept here so additions stay consistent: depth climbs `bg-base` → layers 1..3, with overlays and floating surfaces taking the *opaque* `panel-solid` rather than the translucent `panel-bg` (which would composite against whatever sits beneath); rules climb `border-l1..l4` along f-ui's line ramp; the four text roles collapse onto two, because f-ui expresses hierarchy with fewer steps; and status maps error→danger, warn→warn, success→ok, business→accent, each through that tone's own `-soft`/`-line` derivations.

## Why an attribute rather than an import

The stock and FUI surfaces are served from one frontend build, so a stylesheet that claims `:root` would re-skin `dsh web` too. Everything here is scoped to `body[data-fui-surface]`, and only this package's browser half sets that attribute — mounted solely by the FUI roster. The attribute is also what activates the vendored token sheet's own page rule, which paints the ground, text colour, monospace face, and coordinate grid.

## Model Experience

None, as this package contributes a document attribute and a custom-property sheet to the browser client; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Single dark surface** — f-ui ships only its `cyan` theme, and Product Settings exposes no Appearance selector. ThemeRuntime retains light/dark/system for startup, stock-surface semantics, and extension consumers, but both FUI branches land on the same palette.
- **Mask colours are literals** — the four `bg-mask-*` roles need alpha over the FUI ground, and f-ui exposes no pre-derived mask tone, so they are written as `rgba()` against the known ground value. A ground change silently desynchronises them.
- **No contrast gate** — the mapping was measured on the running surface (body text lands at 11.5–12.1:1 against its ground, well past WCAG AA), but nothing asserts a ratio per role, so a future token change can regress legibility without failing a build.
