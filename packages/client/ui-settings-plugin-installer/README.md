# @deepseek-ai/dsh-client-ui-settings-plugin-installer

English | [中文](README.zh.md)

Desktop-only **Install plugin** tab for the Plugins settings section. The browser plugin contributes one localized `settings.plugins.tab` entry with id `install`; the Web app bundle disables the row outside a desktop Host. Activation performs no Remote call. Submitting one package or Git spec lazily calls `pluginInstaller/add` through [`api-remotes`](../../api/remotes/README.md), disables the form while the mutation runs, and cancels the request when the tab unmounts.

The form warns that installed plugins can execute local code. Stable Host failures become localized messages; bounded package-manager diagnostics remain available under a disclosure. Success names the normalized spec and tells the user to restart DeepSeek FUI, which is when the newly reconciled profile layer enters the Loader tree.

## Model Experience

None, as the installer form changes the profile used after restart without adding anything to a model request or Session history.

#### KV Cache effect

None; opening or submitting the form never changes model input.

## Known Limitations and Deferred Work

- **Restart required** — success can only ask the user to restart DeepSeek FUI; the settings contribution cannot activate a newly installed package in the current Loader tree.
- **Final diagnostics only** — the form shows a busy state while the Remote runs, then exposes bounded stdout and stderr; it does not stream package-manager progress.
