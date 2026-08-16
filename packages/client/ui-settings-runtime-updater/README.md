# @deepseek-ai/dsh-client-ui-settings-runtime-updater

English | [中文](README.zh.md)

Desktop-only General-settings contribution for managed Harness runtime updates. The plugin waits for `settings.general.item`, registers the `desktop-runtime-update` row, and uses the generated `runtimeUpdater` Remote. It reads the current version without network access when mounted; a user click then performs the complete check-and-install request. Local component state owns loading, busy, compatible-update, incompatibility, failure, and restart-required presentation. Unmounting cancels an active Remote request.

The renderer cannot choose a package, registry, tag, destination, pnpm entry, or command argument. It receives only version facts and stable Host outcomes. An incompatible npm release is visible but not installed, and detailed Host or bounded child diagnostics remain behind an expandable disclosure.

## Model Experience

None, as this package renders desktop settings and registers no model-facing input.

#### KV Cache effect

None; the row never assembles or sends a provider request.

## Known Limitations and Deferred Work

- The row appears only in the desktop FUI composition; ordinary Web and non-desktop `fui` launches do not mount either updater half.
- A successful installation requires the user to quit and reopen the desktop application.
