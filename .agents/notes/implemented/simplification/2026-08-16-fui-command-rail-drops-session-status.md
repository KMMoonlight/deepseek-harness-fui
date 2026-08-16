# Agent Note: FUI command rail drops its session status group

Status: implemented

English | [中文](2026-08-16-fui-command-rail-drops-session-status.zh.md)

## Problem

The FUI command rail carried a self-added status group ("会话链路" label plus a live session-state badge) at its right end. Third-party client plugins that predate the FUI surface pin their own controls to the viewport's top-right corner with `position: fixed` — designed against the stock shell, which has no global top bar — and landed exactly on that group (observed with dsh-better-sidebar). The group also duplicated information the conversation surface already presents, and its label read as a trajectory entry while actually reporting session state.

## Decision

The command rail in `packages/client/ui-fui-layout` renders only the product identity (`DSH // 智能体控制台`); the session status group, its locale keys (`command.session`, `session.syncing`, `session.idle`, `session.running`, `session.ready`), and their CSS are removed. The rail's right side stays empty, matching the stock shell's guarantee that the viewport's top-right corner carries no shell-owned content, so fixed-position plugin overlays have nothing to collide with. This partially supersedes the rail's composition as recorded in the [FUI runtime client surface](../architecture/2026-08-14-fui-runtime-client-surface.md) note; that note's facts are updated in place.

## Alternatives considered

- **Keep the status group and reserve a top strip above the rail**: rejected — it spent 40px of every FUI surface to protect an element the shell never needed; removing the element is the smaller design. (The strip was built and reverted within the same change window.)
- **Rename or relocate the badge**: rejected — the session's running state already surfaces in the conversation column; a second, global indicator earned no place once it collided with the plugin ecosystem's assumptions.
- **Keep the group but move plugin overlays via plugin-side patches**: rejected — per-plugin whack-a-mole, and the group wasn't load-bearing to begin with.

## Consequences

- The viewport's top-right corner is shell-quiet again; plugins with the stock-shell fixed-position assumption (dsh-better-sidebar's toggle cluster) no longer overlap FUI chrome.
- Live session state is read from the conversation surface only; nothing global replaces it.
- The `fui-layout` locale namespace shrinks to `skip.main`, `command.title`, `status.profile`, `status.workspace`; the `Badge` import leaves `AppFrame`.

## Testing

The `app-frame` component spec drops the badge assertion; the assembled `fui-surface` golden is refreshed to a rail reading `DSH // Agent console` with no status tail. The macOS title-bar inset and drag-region behavior are unchanged from the pre-strip design.
