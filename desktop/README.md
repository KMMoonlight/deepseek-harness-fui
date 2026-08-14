# desktop — the FUI desktop shell

A Tauri application whose window is a view onto a `dsh --profile fui` process it owns. It spawns the backend on an OS-assigned port, reads the port back from the URL line the web bundle prints, and points the webview at it.

Deliberately outside the pnpm workspace: it has no JavaScript of its own — the page it loads is served by the backend — so a `package.json` here would only subject a Rust crate to the workspace's package gates.

## Why out of process

Two properties of the harness, not preferences:

- **Client plugins arrive as injected `<script>` tags.** A `file://` origin does not serve them, and the shell's only escape hatch is a transport override that would have to be written and maintained.
- **Tauri uses the system webview**, so there is no Node runtime in this process to host the harness even if the page were local.

Loopback HTTP sidesteps both, and it costs nothing in posture: the harness already fences `/api` to loopback authorities and refuses non-loopback binds.

## Process lifetime

The backend is a three-link chain — a `pnpm` launcher shim, the resolved pnpm, then the tsx host — and only the last one holds the port. Killing the process we spawned therefore reaps nothing useful, so the child is put in **its own process group** and every exit path signals the group.

| Exit | Behaviour |
|---|---|
| Window closed | `CloseRequested` reaps the group. |
| App exits | The `Exit` run event reaps the group and clears the pid file. |
| SIGTERM / SIGINT / SIGHUP | A handler kills the group, then restores the default disposition and re-raises, so the exit status stays honest. Tauri installs no handler for these; without one a supervisor's SIGTERM would strand the backend. |
| SIGKILL | Uncatchable. The next launch reaps the recorded pid, so orphans do not accumulate. |

The signal handler reads the group id from an atomic rather than the mutex the rest of the code uses: taking a lock inside a signal handler is not async-signal-safe.

Observed behaviour worth knowing: after a SIGKILL the backend *often* dies on its own, because it writes to a stdout pipe whose reader is gone. That is incidental, not a guarantee, which is why startup reaping exists.

## Running it

The backend is spawned as `pnpm dsh --profile fui --port 0` from the repository root, so a development run needs `pnpm` on `PATH` and a built repository (`pnpm run build`).

```sh
cargo run
```

## Known Limitations and Deferred Work

- **Development launch only** — the backend is spawned through `pnpm` from the repository root. A packaged application must ship a Node runtime and the harness as a sidecar and spawn that instead; until then, launching from Finder fails because GUI processes on macOS do not inherit the shell `PATH`.
- **Boot failure has no dialog** — a backend that never announces its URL aborts setup with a message on stderr. A user launching from an icon sees the window close.
- **The 90s readiness timeout is a guess** — it is generous for a warm checkout and may be short for a cold one on slow hardware.
- **Tray, menu, and window-state behaviour is unverified** — all three are registered and the app starts clean, but their correctness is on-screen and this build was exercised headlessly. Single-instance *is* verified: a second launch exits without starting a second backend.
- **Window state is not saved on SIGTERM** — the signal handler restores the default disposition and re-raises, so Tauri's exit path never runs and the state plugin never writes. Reaping the backend matters more than remembering a window size, but a normal close or tray quit is the only path that persists geometry.
- **The application icon is a generated placeholder** — a real brand icon is still needed, in the per-platform sizes bundling wants.
