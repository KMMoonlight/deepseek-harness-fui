# Agent Note: Electron packages the FUI profile and its plugin runtime

Status: implemented

English | [中文](2026-08-15-electron-fui-desktop-runtime.zh.md)

## Problem

A native desktop window can supervise `dsh --profile fui`, but a development launch that discovers Node and package-manager commands from a repository checkout cannot become a self-contained application. A packaged application launched from an icon cannot rely on the login shell's `PATH`, and a closed application bundle must still preserve Harness's profile-bundle installation model instead of turning the FUI composition into fixed desktop code.

The application role also needs to stay explicit. Cordis plugins extend the Harness process; an operating-system application owns process startup, native windows, single-instance behavior, navigation policy, tray lifetime, and distribution artifacts. Treating that shell as another Cordis plugin would leave no process available to load it.

## Decision

`apps/desktop` is a private Electron application. It starts the built `@deepseek-ai/dsh` CLI with `--profile fui --host 127.0.0.1 --port 0`, accepts only the canonical loopback readiness URL, and creates one sandboxed renderer for that origin. Electron owns single-instance activation, window restore, tray lifetime, external-link handoff, permission denial, startup diagnostics, and bounded Host shutdown.

The preload marks the Electron renderer without exposing an IPC bridge. The FUI command rail uses that marker as a native drag region and excludes interactive descendants. The BrowserWindow configuration explicitly permits movement, edge resizing, minimize, maximize, and fullscreen while retaining platform window controls.

The packaged application uses its Electron executable with `ELECTRON_RUN_AS_NODE=1` as the Host's Node runtime. `pnpm deploy` stages a closed production dependency tree containing the CLI, Base/Web/FUI bundles, Web frontend, every required workspace peer, and pnpm. The staging pass materializes workspace links before Electron Builder copies the tree into application resources, and the after-pack hook checks all three executable entries: CLI, frontend, and pnpm. This tree remains the immutable fallback when an [independent official DSH runtime with the application FUI overlay](2026-08-16-independent-official-dsh-desktop-overlay.md) is selected from Harness user storage.

The ordinary writable `fui` profile remains under `~/.dsh/profiles/fui`. In-box bundles resolve from the packaged installation; third-party bundle dependencies and their lockfile remain in the profile. The desktop Host supplies the packaged pnpm JavaScript entry through `DSH_PNPM_ENTRY`; `dsh plugin` then runs that entry with the current Node-compatible executable rather than resolving a shell command. This is deployment wiring, not a second plugin installer: dependency reconciliation and `dsh.bundle.patch` activation remain owned by the existing profile command.

The desktop-only plugin installer exposes that command through a bounded Host Remote and a Client settings tab. It accepts one package or Git argument, never invokes a shell, serializes profile mutations, limits retained output and execution time, and joins request cancellation with plugin teardown. The ordinary Web assembly disables both rows. Successful installation changes the profile on disk and requires an application restart before the newly installed bundle enters the running plugin graph.

The renderer initially reuses the Web Host's loopback HTTP/WebSocket carrier. This is a staged application transport, while the [GUI protocol decision](2026-07-19-gui-layering-and-rpc-protocol.md) continues to reserve an Electron IPC carrier. The Client plugin graph, FUI composition, and Host services do not depend on that later carrier change.

## Verification

Host supervisor specs cover chunked readiness parsing, invalid origins, startup failures, readiness timeout, unexpected exits, coalesced shutdown, and SIGKILL escalation. Window lifecycle specs cover hide-on-close, restore, concurrent creation, and teardown failure. A process adapter spec pins the `fui` profile arguments and Electron Node environment. Packaging checks pin the staged FUI, frontend, and pnpm dependencies together with the movable and resizable BrowserWindow configuration. The assembled FUI browser acceptance verifies the native drag region and interactive exclusions. Installer specs pin the exact CLI argv, desktop-only load guard, serialized mutation, diagnostics, timeout, cancellation, and teardown behavior; Client tests cover lazy invocation and every visible result state. An interactive packaged-app smoke moved the window through the command rail and resized it through the frame edge. The built CLI acceptance suite runs a fake packaged pnpm entry and verifies that a newly initialized `fui` profile retains all three in-box bundle layers.

## Alternatives considered

- **Turn the desktop shell into a Cordis plugin**: rejected because a plugin cannot own installation, process creation, or an operating-system application lifecycle before the Harness process exists.
- **Use a native shell that discovers system Node**: rejected as the distribution path because icon launch would still depend on machine setup, while a separate runtime assembly would duplicate the Node-compatible runtime Electron already carries.
- **Freeze installed plugins inside the application resources**: rejected because resources are immutable application state; profile dependencies and lockfiles are user state and must survive application replacement.
- **Require system pnpm for plugin installation**: rejected because GUI applications do not inherit a reliable shell environment, and a package advertised as self-contained must carry its package manager.
- **Implement Electron IPC before packaging**: deferred because it combines a carrier migration with the distribution foundation. The loopback carrier already has origin checks and preserves the current Client/Host protocol.

## Consequences

- Users launch the installed application by clicking its icon; no startup command or separately installed Node/pnpm is required.
- The FUI command rail is native window chrome in Electron; future interactive descendants must remain excluded from the drag region.
- Third-party Cordis plugins remain installable as profile bundles through the desktop settings form. Installation is trusted-code execution, and a restart is required before the new bundle becomes active.
- Compatible published Harness closures may be selected from managed user storage; invalid selections fall back to the immutable packaged closure.
- The desktop artifact is larger because Electron, the complete FUI runtime, and pnpm ship together.
- `apps/desktop` is the sole desktop application and owns the packageable root commands. Platform signing remains a release concern rather than a second shell implementation.
- The Electron shell adds no model-visible input; session logging and model context remain owned by the mounted Harness plugins.
