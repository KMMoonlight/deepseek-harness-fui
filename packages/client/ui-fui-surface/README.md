# @deepseek-ai/dsh-client-ui-fui-surface

The FUI surface claim. Its browser half marks the document with `data-fui-surface` and loads the alias bridge that repoints [`ui-theme`](../ui-theme/README.md)'s `--dsw-alias-*` layer at [`ui-fui`](../ui-fui/README.md)'s `--fui-*` tokens.

## Why this is the whole skin

`ui-theme` owns the semantic alias layer, and [the styling reference](../../../docs/web-styling.md) requires every feature package to consume those aliases and forbids literal colours. f-ui enforces the mirror-image rule on its own side, with a test that fails per file on any colour literal. Two disciplined variable systems under non-colliding prefixes means repointing one at the other re-skins all thirty-odd stock feature packages — conversation, trajectory, tool cards, sidebar, settings — without editing a single component.

ui-theme names tokens in two families, and both must be bridged: the `--dsw-alias-*` semantic layer, and a smaller `--dsw-specific-*` set naming concrete surfaces (sidebar fill, composer input, menus, bubbles). Missing the second family is not subtle — the sidebar and composer stay white on the FUI ground — but it is invisible until someone opens the affected screen, so [the coverage spec](tests/bridge-coverage.client.spec.ts) fails the build on any token this sheet does not restate, on any stale entry ui-theme has dropped, and on any mapping that resolves to something other than a `--fui-*` token.

Roles map on a few rules, kept here so additions stay consistent: depth climbs `bg-base` → layers 1..3, with overlays and floating surfaces taking the *opaque* `panel-solid` rather than the translucent `panel-bg` (which would composite against whatever sits beneath); rules climb `border-l1..l4` along f-ui's line ramp; the four text roles collapse onto two, because f-ui expresses hierarchy with fewer steps; and status maps error→danger, warn→warn, success→ok, business→accent, each through that tone's own `-soft`/`-line` derivations.

## Why an attribute rather than an import

The stock and FUI surfaces are served from one frontend build, so a stylesheet that claims `:root` would re-skin `dsh web` too. Everything here is scoped to `body[data-fui-surface]`, and only this package's browser half sets that attribute — mounted solely by the FUI roster. The attribute is also what activates the vendored token sheet's own page rule, which paints the ground, text colour, monospace face, and coordinate grid.

## Model Experience

None, as this package contributes a document attribute and a custom-property sheet to the browser client; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Single dark surface** — f-ui ships only its `cyan` theme, so the bridge has no light variant. ui-theme's light/dark preference still resolves and still drives the stock surface, but on the FUI surface both branches land on the same palette.
- **Mask colours are literals** — the four `bg-mask-*` roles need alpha over the FUI ground, and f-ui exposes no pre-derived mask tone, so they are written as `rgba()` against the known ground value. A ground change silently desynchronises them.
- **No contrast gate** — the mapping was measured on the running surface (body text lands at 11.5–12.1:1 against its ground, well past WCAG AA), but nothing asserts a ratio per role, so a future token change can regress legibility without failing a build.
