# @deepseek-ai/dsh-host-runtime-updater

English | [中文](README.zh.md)

Desktop-only Host provider for managed official `@deepseek-ai/dsh` runtime updates. `RuntimeUpdaterGateway` publishes the generated direct Remotes `runtimeUpdater/describe` and `runtimeUpdater/update`. The FUI bundle disables the provider unless `DSH_DESKTOP=1`; the constructor repeats that guard and requires exact DSH and FUI versions, a valid supported-DSH semver range, absolute managed-storage, overlay, and pnpm paths, and an HTTPS or loopback registry.

One update request checks the configured npm dist-tag and installs a newer official DSH version only when it falls inside this desktop release's compatibility range. The provider writes a private temporary project under `$DSH_HOME/desktop-runtime`, invokes the packaged pnpm entry through `ctx.subprocess`, and installs the official dependency closure with the hoisted linker. It then copies the immutable application-owned FUI packages and Web frontend over that closure. Official shared packages remain selected by the installed DSH release, while the FUI surface and updater stay at the desktop application's exact version. Output and execution time are bounded, request cancellation is joined with plugin teardown, and commands use argv arrays without a shell and the subprocess provider's credential-scrubbed environment.

Installation never edits application resources. A completed tree must contain the exact official CLI version, every exact-version FUI overlay package, and the Web frontend; the local DSH manifest also names the FUI bundle so profile fallback discovery can reach the overlay. The installed CLI must report the requested version through `dsh --version`. Only then does an atomic `current.json` pointer select it for the next launch. The pointer records the FUI version, so a later desktop release rejects a stale overlay composition until the user installs a compatible runtime again. Existing invalid version directories move to a recoverable quarantine directory. The Electron shell validates the pointer again before boot and preserves a failed pointer before falling back to the bundled runtime.

Configuration owns the deployment values: `currentVersion`, `currentSource`, `fuiVersion`, `compatibleDshRange`, `overlayRoot`, `runtimeRoot`, `pnpmEntry`, `registryUrl`, `distTag`, `checkTimeoutMs`, `installTimeoutMs`, `maxOutputBytes`, and `graceMs`. Package identity and the overlay package list are fixed application rules rather than renderer input.

## Model Experience

None, as an update changes the plugin runtime available to a later application launch without registering prompt, tool, message, or provider input.

#### KV Cache effect

None; the updater does not assemble model requests or append Session events.

## Known Limitations and Deferred Work

- **Restart required** — a committed pointer affects the next desktop launch; the running Host and Client graph remain unchanged.
- **Declared compatibility range** — an official DSH version outside the desktop release's range is shown as incompatible and is not installed. Breaking upstream changes therefore require a new desktop release with an updated FUI overlay and range.
- **Runtime-only compatibility** — changes that require a newer Electron shell still need a complete signed desktop application release.
