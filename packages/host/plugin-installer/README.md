# @deepseek-ai/dsh-host-plugin-installer

English | [中文](README.zh.md)

Desktop-only Host adapter for installing one package or Git spec into a writable profile. `PluginInstallerGateway` publishes the generated direct Remote `pluginInstaller/add`, then runs the existing `dsh plugin --profile <profile> add -- <spec>` path through `ctx.subprocess`. The existing CLI remains the only owner of profile initialization, pnpm invocation, and `dsh.bundle` reconciliation.

The Web app bundle disables this Host row unless `DSH_DESKTOP=1`; the constructor repeats that check and requires an existing absolute CLI entry. Requests pass one bounded, non-option argv value without shell parsing. One installation may run at a time. The subprocess service bounds both output tails, terminates the process tree on request cancellation, timeout, or plugin teardown, and the Remote returns stable business failures with those diagnostics. A successful result carries `restartRequired: true` because the active Loader tree does not rewrite itself around a newly installed profile layer.

Configuration owns the deployment values: `cliEntry`, `profile`, `timeoutMs`, `maxOutputBytes`, `graceMs`, and `maxSpecChars`. The desktop application supplies `DSH_DESKTOP_CLI_ENTRY` and packaged `DSH_PNPM_ENTRY`; the bundle row maps the CLI entry into this plugin's config, while the installer explicitly forwards the pnpm entry because the subprocess provider scrubs all ambient `DSH_*` variables.

## Model Experience

None, as this desktop-only profile installer changes future Loader composition without registering prompt, tool, message, or provider input.

#### KV Cache effect

None; installation never assembles model input or changes the current Session history.

## Known Limitations and Deferred Work

- **Restart required** — a successful package transaction updates the profile on disk but does not activate the new layer in the running Loader tree.
- **One mutation at a time** — concurrent installation requests receive `busy`; the Remote exposes bounded final diagnostics rather than a live package-manager progress stream.
