# Agent Note: FUI status rail hosts the session stats line

Status: implemented

English | [中文](2026-08-16-fui-status-rail-hosts-stats.zh.md)

## Problem

The session stats readout (turns/steps, LLM wall time, TTFT and throughput, cache hit, billed tokens) rendered only under the composer, inside the conversation scrollport — far from the FUI shell's own chrome and invisible in the rail where a user expects ambient readouts. Moving it looked trivial but hits a framework constraint: root-scope slot components receive only the global seat (`useSessions`/`useWorkspaces`), while the readout's data lives behind session-scope standard-kit hooks (`useSession`, `useProjection`).

## Decision

`ui-fui-layout` declares a new session-scope list slot `'shell.status'` and renders it in the status rail after the workspace segment. Session scope is the point: entries mounted there receive the session standard kit from the framework, so `StatsLine` registers unchanged — the shell never reads projection data itself. `ui-conversation` keeps its `conversation.composer.dock` registration (the stock assembly has no `shell.status` declaration, so nothing changes there) and adds a `slots.inject('shell.status', …)` registration that installs only in the FUI assembly. Inside FUI, a `body[data-fui-surface] [data-slot='conversation.composer.dock']` rule hides the dock instance so the line keeps exactly one visible home, and a `[data-slot='shell.status']` override swaps the centered composer-axis styling for the rail's chrome. The rail keeps its fixed identity segments (profile, workspace, product name) nowrap with `flex-shrink: 0`; the readout renders out of flow in `statusSlot`, an absolutely stretched band whose inline `left`/`right` come from the concession solve, so the line stays centered on the composer axis at any column widths and elides inside the band. With no current session the strict session scope mounts nothing, so the rail shows no placeholder.

## Alternatives considered

- **Let the root-scope AppFrame read the stats itself**: rejected — root components get no `useProjection`; the framework's session provide channel is deliberately a session-scope seat, and punching a root-scope read path through web-react widens the framework for one consumer.
- **Move the registration outright (stock loses the line)**: rejected for now — every stock conversation golden containing the stats row would need a refresh while the `cordis-tool-round` replay fixture is broken (its llm-replay script needs a keyed re-record), and refreshing would bake the broken state into goldens. The outright move stays available once that fixture is repaired.
- **Fork the component per surface**: rejected — one component, one data path; only the mount point and chrome differ.

## Consequences

- FUI shows the readout in the status rail; stock `dsh web` is bit-for-bit unchanged, including all stock goldens.
- `StatsLine` mounts twice in the FUI assembly (dock instance hidden by CSS); both read the same shared projection stores, so the cost is one extra React subtree.
- `'shell.status'` is a public additive seat: any plugin can contribute rail readouts in the FUI assembly, session-scoped.
- The `ui-conversation` package gains a type-only dependency on `dsh-client-ui-fui-layout/client` for the SlotMap merge (devDependency + tsconfig reference, same pattern as its existing `ui-layout` import).

## Testing

The `ui-fui-layout` apply spec pins the `'shell.status'` declaration (`list`/`session`); the app-frame spec asserts the rail's renderSlot call. The 474 existing specs across both packages pass unchanged, including all StatsLine behavior coverage. No golden changes: the FUI surface golden covers the no-session state (empty seat), and stock goldens are untouched. The desktop composition renders the populated rail line through the same projections the dock instance already used.
