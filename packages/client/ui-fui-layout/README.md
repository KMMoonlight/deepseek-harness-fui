# @deepseek-ai/dsh-client-ui-fui-layout

English | [中文](README.zh.md)

The FUI surface's application frame, forked from [`ui-layout`](../ui-layout/README.md) and mounted in its place by the `fui` profile. Both packages declare the same child slots and `root` is single-kind, so the profile disables the stock row before it mounts this package.

## FUI shell

The frame owns a three-row control shell around the application columns: an upper command rail reports the product identity, the center row holds sidebar, conversation, and details, and a lower status rail reports the active surface and Workspace context while hosting the session-scope `shell.status` seat (the session stats readout mounts there in this assembly). The center surface uses the f-ui grid, steel rules, square resize controls, and the target palette supplied by [the alias bridge](../ui-fui-surface/README.md). A skip link targets the center column, and narrow viewports retain the command and status rails while collapsing secondary labels. The [Electron desktop shell](../../../apps/desktop/README.md) marks its renderer so CSS turns the command rail into a native drag region while excluding interactive descendants; its macOS title-bar marker adds the leading inset needed to clear the system traffic lights without changing browser geometry.

The root registration binds the `fui-layout` locale namespace, so command, status, and accessibility copy follows the active client locale. Product marks such as `DSH` and `DEEPSEEK HARNESS` remain literal.

`Badge` and `ScreenEffects` come from [`ui-fui`](../ui-fui/README.md). The browser shell shares that library through `PLATFORM_MODULES`, so runtime client bundles consume the same React and f-ui module instance as the application instead of bundling a second copy.

## Preserved layout behavior

Column sizing, drag handles, the narrow-window concession chain, the `ctx.layout` panel-geometry service, and the theme presenter retain the behavior of `ui-layout`. The plugin registers into the runtime-owned `root` slot and declares `sidebar`, `conversation`, `details`, and `conversation.empty`. The sidebar resize boundary is an invisible hit strip, while details retains a visible square handle. Only details shrinks during concession and then auto-closes. A closed sidebar retains a 56px control rail while details closes to zero width.

The theme presenter projects resolved `ctx.theme` snapshots onto the document: native color scheme, the active body theme attribute, inline alias tokens, and one owned theme-color metadata node. Disposing the presenter removes those global writes.

AppFrame always mounts the conversation and details columns; a connected Session renders through `SessionProvider`. The transient layout store starts the sidebar at its default width and details closed, and it never reads or writes `localStorage`. Hero and other unselected states also derive a zero rendered details width without changing that stored preference. AppFrame retains the last non-blank Session id across those states: the first Session remains closed, an explicit details action opens the contract default width, returning to the same Session restores its unchanged width, and selecting a different Session closes details before paint. The conversation owner share is empty, while the sidebar owner share contains only `collapsed` and `width`; registrants obtain business data from standard hooks and actions from their own inject faces.

The `/client` exports are the plugin body (`apply`/`inject`), `LayoutController`, and the owner-share interfaces. AppFrame, the panel store, and the concession solver remain package-internal.

## Model Experience

None, as the layout shell manages browser viewing state; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **Panel geometry is transient** — reload restores the sidebar default and details closed; switching between distinct Session ids also closes details and forgets its dragged width, while unselected surfaces render details at zero width without modifying geometry.
- **Concession-chain auto-close derives a zero width without touching the preferred width** — the panel restores itself when the window widens; consumers must not read the stored details width as the rendered truth.
- **No scroll anchoring during squeeze reflow** — layout changes may move the reader's viewport.
