# Agent Note: Desktop plugin installation reuses profile reconciliation

Status: implemented

English | [中文](2026-08-15-desktop-plugin-installation.zh.md)

## Problem

The packaged desktop runtime can execute `dsh plugin --profile fui add`, but requiring a terminal leaves plugin distribution outside the desktop experience. Exposing a general process launcher or the package manager directly to the renderer would also give browser code broader authority than installation needs. The ordinary Web application must not gain a remote package-install surface merely because it shares the FUI bundle.

## Decision

`dsh-host-plugin-installer` is the desktop-only Host adapter for one installation mutation. Its Remote method accepts one package or Git spec and invokes the existing `dsh plugin --profile fui add -- <spec>` command as an argv array through `dsh-subprocess`. The adapter requires `DSH_DESKTOP=1` and an existing absolute CLI entry at load. The Web application bundle disables both the Host adapter and its Client settings contribution unless the desktop process sets that marker.

The adapter serializes profile mutations because pnpm and the profile manifest share writable state. It rejects empty specs, option-like values, whitespace, control characters, and excessive length before process creation. Child output is bounded, execution has a deadline, request cancellation and plugin teardown terminate the managed process tree, and results expose stable business failure codes with retained diagnostics. It explicitly forwards the packaged `DSH_PNPM_ENTRY` because the subprocess provider removes ambient `DSH_*` variables.

`dsh-client-ui-settings-plugin-installer` contributes an **Install plugin** tab under Plugins settings. The form invokes the Remote only on submission, disables concurrent input, cancels the request when unmounted, explains that packages execute trusted code, and reports success, stable failures, and bounded diagnostics. Installation commits the profile but does not mutate the running Cordis graph; success therefore requires a desktop restart.

## Verification

Host tests pin the Remote metadata, exact shell-free argv, packaged pnpm forwarding, validation, serialization, bounded diagnostics, exit handling, timeout, request cancellation, teardown, and desktop load guard. Client tests verify contribution ownership, lazy invocation, disabled submission, unmount cancellation, localized success and failure states, and expandable diagnostics. The Host and Client aggregate typechecks and builds include the new packages, while the assembled desktop FUI acceptance verifies that the tab is present only in the desktop composition.

## Alternatives considered

- **Run pnpm directly from the renderer**: rejected because it would require a privileged renderer bridge and duplicate the profile command's dependency and patch-layer rules.
- **Expose the installer in ordinary Web profiles**: rejected because a remotely reachable browser surface must not gain package-install authority by default.
- **Load the new bundle immediately**: rejected because live replacement would need transactional dependency reconciliation, Cordis graph teardown, rollback, and session semantics. Restart provides a clear activation point.
- **Accept a free-form command line**: rejected because installation needs one opaque package argument, not shell parsing or arbitrary options.

## Consequences

- Desktop users can install npm or Git-distributed Cordis bundles from Settings without running a command.
- Installation remains compatible with the CLI, profile lockfile, patch-layer activation, and packaged pnpm runtime.
- A successful install is durable but inactive until restart.
- Package installation executes third-party code. The interface communicates that trust requirement but does not provide publisher verification, ratings, or a curated marketplace catalog.
- The installer adds no model-visible input or session event. It changes the plugin composition available to later application runs.
