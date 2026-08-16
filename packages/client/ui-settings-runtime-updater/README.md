# @deepseek-ai/dsh-client-ui-settings-runtime-updater

English | [中文](README.zh.md)

Desktop-only Updates-settings contribution for managed official DSH updates. The plugin mounts the generated `runtimeUpdater` Remote through the generic API Gateway, waits for `settings.section`, and registers the `updates` section. Owning this contribution outside the shared API Remote assembly lets the application overlay add its update protocol without replacing the official DSH release's other Remote contributions. The section reads the active official DSH version without network access when mounted; **Check for updates** performs the check-only `check` Remote (latest version, availability, compatibility), and **Update now** performs the complete check-and-install `update` request. Local component state owns loading, busy, compatible-update, incompatibility, failure, and restart-required presentation. Unmounting cancels an active Remote request and withdraws the contribution.

The renderer cannot choose a package, registry, tag, destination, pnpm entry, or command argument. It receives only version facts and stable Host outcomes. An incompatible npm release is visible but not installed, and detailed Host or bounded child diagnostics remain behind an expandable disclosure.

## Model Experience

None, as this package renders desktop settings and registers no model-facing input.

#### KV Cache effect

None; the row never assembles or sends a provider request.

## Known Limitations and Deferred Work

- The row appears only in the desktop FUI composition; ordinary Web and non-desktop `fui` launches do not mount either updater half.
- An official DSH version outside the application-declared compatibility range remains visible but cannot be installed from this desktop release.
- A successful installation requires the user to quit and reopen the desktop application.
