# @deepseek-ai/dsh-host-runtime-updater

English | [中文](README.zh.md)

Desktop-only Host provider for managed `@deepseek-ai/dsh` runtime updates. `RuntimeUpdaterGateway` publishes the generated direct Remotes `runtimeUpdater/describe` and `runtimeUpdater/update`. The FUI bundle disables the provider unless `DSH_DESKTOP=1`; the constructor repeats that guard and requires exact semver, absolute managed-storage and pnpm paths, and an HTTPS or loopback registry.

One update request checks the configured npm dist-tag and installs only a newer package whose published dependency map includes `@deepseek-ai/dsh-fui-app`. The provider writes a private temporary project under `$DSH_HOME/desktop-runtime`, invokes the packaged pnpm entry through `ctx.subprocess`, bounds output and execution time, and joins request cancellation with plugin teardown. Child processes receive the subprocess provider's credential-scrubbed environment. Package-manager and validation commands use argv arrays without a shell.

Installation never edits application resources. A completed dependency tree must contain the exact CLI version, the FUI bundle, and the Web frontend, and the installed CLI must report that version through `dsh --version`. Only then does an atomic `current.json` pointer select it for the next launch. Existing invalid version directories move to a recoverable quarantine directory. The Electron shell validates the pointer again before boot and preserves a failed pointer before falling back to the bundled runtime.

Configuration owns the deployment values: `currentVersion`, `currentSource`, `runtimeRoot`, `pnpmEntry`, `registryUrl`, `distTag`, `checkTimeoutMs`, `installTimeoutMs`, `maxOutputBytes`, and `graceMs`. Package identity and the FUI dependency requirement are fixed safety rules rather than renderer input.

## Model Experience

None, as an update changes the plugin runtime available to a later application launch without registering prompt, tool, message, or provider input.

#### KV Cache effect

None; the updater does not assemble model requests or append Session events.

## Known Limitations and Deferred Work

- **Restart required** — a committed pointer affects the next desktop launch; the running Host and Client graph remain unchanged.
- **FUI publication required** — an upstream `@deepseek-ai/dsh` release that omits `@deepseek-ai/dsh-fui-app` is reported as incompatible and is never installed.
- **Runtime-only compatibility** — changes that require a newer Electron shell still need a complete signed desktop application release.
