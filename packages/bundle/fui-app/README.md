# `@deepseek-ai/dsh-fui-app`

English | [中文](README.zh.md)

The FUI surface bundle. [`cordis.patch.yml`](cordis.patch.yml) stacks over [`dsh-web-app`](../web-app/README.md), which itself stacks over [`dsh-base`](../base/README.md), and swaps the browser roster's presentation rows for their f-ui counterparts. The `fui` profile composes all three in that order.

## Why a layer over dsh-web-app, not a fork of it

The FUI surface differs from the stock web surface by **which client plugins the roster mounts**, not by how the page is served. Everything transport-shaped — the webserver, the API gateway, the browser-trust fence, resolving the built frontend dist — is identical, so this bundle does not restate those rows and inherits them.

That has a concrete payoff: `dsh web` keeps working unchanged beside `dsh --profile fui`, sharing one frontend build. During the skin work the two surfaces can be booted side by side and compared directly, which is the fastest way to catch a token mapping that reads worse than the stock one.

It also keeps the fork's upstream footprint small. A separate surface would need its own runtime glue, because the frontend dist location is deliberately not configurable — `dsh-web-app` resolves it through the frontend package's exports and documents it as workspace knowledge of that bundle, never user config. Copying that glue to change one path would fork ~185 lines that then rot silently against upstream.

## Upstream touchpoints

Composing this bundle needs two additions outside this package, both one line:

- `PROFILE_TEMPLATES` in [`app-boot`](../../boot/app-boot/README.md#profiles) gains a `fui` entry, so `dsh --profile fui` auto-initializes like `web` and `headless` instead of requiring a `dsh plugin` init.
- The `dsh` CLI app depends on this package, because profile bundles resolve through the flat module fallback built from that app's dependency closure.

## Model Experience

### FUI surface persona

#### What the model sees

The persona restated by this layer is the stock coding-agent persona plus one sentence naming the visual system of the GUI the model is surfaced through, so the model does not describe the interface in stock terms when a user asks what they are looking at. `{{model}}` and `{{cwd}}` are the stock substitutions already owned by the system-prompt row; this layer adds only the trailing sentence.

##### Verbatim persona text

```markdown
You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}. The GUI you are surfaced through uses the FUI visual system: a dark navy ground with thin steel-blue rules and teal highlights.
```

#### Token effect

One added sentence in the system prompt, constant per session.

#### KV Cache effect

The persona sits in the system prompt's stable head and does not change for the life of the process, so it does not invalidate the cache across turns.

## Known Limitations and Deferred Work

- **Shares one frontend build with `dsh-web-app`** — both surfaces load the same dist, so an application-layer change (the Tailwind utility build) reaches the stock surface too. Only the roster and its theme differ.
- **Feature packages remain shared** — the roster replaces the surface claim and application layout, while conversation, sidebar, Workspace, settings, and tool-card packages stay common to both profiles. Their FUI rules activate only under `body[data-fui-surface]`.
- **No composition test asserts the layer order** — that the FUI rows land over the web rows is verified by reading `--dump-config`, not by a gate.
