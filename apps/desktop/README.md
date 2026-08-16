# DeepSeek FUI Desktop

English | [中文](README.zh.md)

The Electron application owns a `dsh --profile fui` Host process and displays its loopback Web UI in a hardened native window. The desktop shell is an application assembly, not a Cordis plugin; the Harness process it starts remains plugin-based.

## Development

Install the workspace dependencies, then run:

```sh
pnpm run dev:desktop
```

The command builds the Harness packages, Web frontend, and Electron entries before starting the app. Closing the main window hides it while the tray keeps the Host alive. Opening the app icon again restores the existing window. Explicit quit from the tray stops the Host, escalating after a five-second grace period if it does not exit.

The renderer can navigate only within the loopback origin printed by the Host. HTTP and HTTPS links for other origins open in the system browser, new windows are denied, renderer Node integration is disabled, context isolation and sandboxing are enabled, and renderer permission requests are rejected. A sandbox-compatible preload marks the Electron shell and the macOS title-bar overlay when the renderer document becomes available. The FUI command rail becomes a native drag region, keeps interactive descendants clickable, and reserves the macOS window-control inset. The native window remains movable, resizable, minimizable, maximizable, and fullscreen-capable through the platform controls and frame edges.

## Packaging

Create an unpacked application for the current platform:

```sh
pnpm run package:desktop
```

Create the configured distribution artifact (`dmg`/`zip`, `nsis`, or `AppImage`):

```sh
pnpm run dist:desktop
```

Both commands perform the complete repository build and stage a closed production dependency tree. A packaged app runs the staged CLI through Electron's Node mode, so it does not require a separately installed Node.js or pnpm. The packaging check rejects an artifact missing the CLI, Web frontend, or bundled pnpm entry.

## Plugins and user data

The app boots the ordinary writable `fui` profile under `~/.dsh/profiles/fui`. In-box bundles come from a validated managed runtime when one is selected, otherwise from the immutable packaged runtime; third-party profile bundles and their lockfile remain in the user profile, so runtime and application upgrades do not erase them.

The packaged Host receives the bundled pnpm entry through `DSH_PNPM_ENTRY`. Open **Settings → Plugins → Install plugin**, enter one npm package or Git spec, and submit it to the desktop-only installer. The Host invokes the existing profile command without a shell or login-shell dependency:

```sh
dsh plugin --profile fui add <package-or-git-spec>
```

Installation changes executable application composition. Use only packages from sources you trust. One installation may run at a time, output and execution time are bounded, and closing the tab cancels its request. A successful installation asks the user to restart the desktop application before the new bundle becomes active. The form accepts a package or Git spec; catalog browsing, package ratings, and publisher verification remain distribution-service concerns.

## Runtime updates

**Settings → General → Desktop runtime** shows the active `@deepseek-ai/dsh` version. **Check and update** reads the configured npm dist-tag and automatically installs a newer compatible runtime under `$DSH_HOME/desktop-runtime`. It never edits application resources or a global npm installation.

Compatibility fails closed: the published root package must declare `@deepseek-ai/dsh-fui-app`, the installed tree must contain the FUI bundle and Web frontend, and the CLI must report the requested version. A successful install becomes active after the application is fully restarted. Electron validates the managed tree again before boot; an invalid tree or a Host that fails before readiness is preserved for diagnostics and the application falls back to its bundled runtime. An npm release without the FUI bundle is reported as incompatible and is not installed.

## Known limitations

The first Electron assembly deliberately reuses the loopback HTTP/WebSocket carrier. It can move to the reserved Electron IPC carrier later without changing the FUI plugin roster or Host services.

Distribution signing and notarization credentials are not part of this repository. Unsigned local artifacts may require platform-specific development overrides before the operating system opens them.

`apps/desktop` is the only desktop shell and owns the root desktop commands and distribution artifacts.

## Model Experience

The desktop shell adds no model-visible input. The FUI profile and its installed bundles own the same logged model context as other launch surfaces.
