# Agent Note: Desktop updates use a validated managed runtime

Status: implemented
Archived: 2026-08-16

English | [中文](2026-08-16-desktop-managed-runtime-updates.zh.md)

## Problem

The packaged desktop application carries a complete Harness runtime, but replacing the whole application is disproportionate when only published Harness packages change. Updating `node_modules` inside application resources is not acceptable: those files are part of the immutable, signed application, and a partial package update can mix the CLI, FUI bundle, Web frontend, and Host plugins from incompatible releases. A renderer-facing package-manager bridge would also expose more local authority than one fixed product update needs.

The npm package identity alone does not establish FUI compatibility. A published `@deepseek-ai/dsh` version can omit this product's `@deepseek-ai/dsh-fui-app` dependency. Selecting such a version would leave the persisted `fui` profile without its in-box bundle and make the next launch fail.

## Decision

The FUI layer mounts a desktop-only capability with a Host provider and a Client settings consumer. `dsh-host-runtime-updater` owns registry access, compatibility checks, package-manager execution, installation validation, and the active-version pointer. `dsh-client-ui-settings-runtime-updater` contributes one General-settings row. The renderer can request `describe` or one complete `update`; package identity, registry, dist-tag, filesystem destination, process policy, and command arguments remain Host configuration.

One click reads the configured npm dist-tag. A version is eligible only when it is valid semver, newer than the running version, and its registry manifest declares `@deepseek-ai/dsh-fui-app`. The Host installs the exact `@deepseek-ai/dsh` version into a private temporary project under `$DSH_HOME/desktop-runtime`, using the packaged pnpm entry through the managed subprocess service. The install receives the credential-scrubbed parent environment, bounded output, a deadline, request cancellation, and plugin-teardown cancellation.

The provider moves an invalid existing version into a recoverable quarantine directory. A fresh tree must contain the exact CLI package, FUI bundle, and Web frontend, and `dsh --version` must report the requested version. The provider atomically writes `current.json` only after those checks succeed. Application resources remain unchanged and continue to provide pnpm and the fallback runtime.

Electron validates `current.json` and its referenced tree before spawning the Host. A managed runtime is attempted first. Invalid pointer data or missing entries are preserved outside the active pointer location, and a managed Host that fails before readiness receives the same treatment; Electron then starts the packaged runtime. The pointer affects only the next application launch, so the running Cordis graph is never replaced around active Sessions or profile mutations.

The [desktop runtime packaging decision](../architecture/2026-08-15-electron-fui-desktop-runtime.md) continues to own the Electron process and immutable baseline. The [desktop plugin installation decision](2026-08-15-desktop-plugin-installation.md) remains independent: plugin installation mutates the writable `fui` profile, while runtime installation selects the in-box package closure that resolves that profile.

## Verification

Host tests cover registry response validation, exact-version comparison, the mandatory FUI dependency, serialized updates, package-manager argv and environment, bounded diagnostics, timeout, cancellation, structural validation, CLI version validation, pointer commit, quarantine, and teardown. Electron tests cover pointer parsing, managed-first selection, invalid-pointer fallback, and managed-readiness fallback. Client tests cover initial description, disabled and busy states, one-click invocation, cancellation, localized success, incompatibility, and stable failures. The assembled desktop FUI acceptance records the General-settings row through the real Host, Remote, Client plugin, and slot graph without making a registry request.

## Alternatives considered

- **Modify application resources in place**: rejected because signed application files are immutable distribution state, and an interrupted or partial install would corrupt the only bootable runtime.
- **Install any newer `@deepseek-ai/dsh` release**: rejected because the root package may omit the FUI bundle; package identity and a successful CLI smoke do not prove that the FUI profile can compose.
- **Run npm or pnpm in the renderer**: rejected because the renderer needs one fixed update operation, not general filesystem, registry, or process authority.
- **Use a global npm installation**: rejected because icon launch must remain self-contained, global package ownership is outside the application, and global updates cannot provide an atomic fallback.
- **Require a complete desktop release for every Harness change**: retained for Electron-shell and signing changes, but rejected as the only runtime path because a validated user-owned runtime can update the plugin closure without modifying the application.

## Consequences

- A user explicitly clicks **Check and update**; there is no silent background installation.
- Compatible npm releases install without a terminal, but activate only after the application is fully restarted.
- Releases that omit the FUI bundle are reported as incompatible and cannot replace the working runtime.
- The application carries two potential runtime copies after an update: the immutable fallback and the selected managed tree. Quarantined failures consume additional user storage until an operator removes them.
- Profile data and third-party plugins remain under `$DSH_HOME/profiles/fui` and survive both runtime and application updates, but a third-party plugin may still require its own compatibility update.
- The updater adds no model-visible input or Session event.
