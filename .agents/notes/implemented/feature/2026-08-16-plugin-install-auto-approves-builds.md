# Agent Note: Plugin installation auto-approves pnpm's build-script allowlist

Status: implemented

English | [中文](2026-08-16-plugin-install-auto-approves-builds.zh.md)

## Problem

pnpm ≥11 hard-fails an install when a git-hosted package's prepare script (`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`) or any dependency's build scripts (`ERR_PNPM_IGNORED_BUILDS`) are absent from the profile's `allowBuilds`. Every git-distributed plugin — and every plugin with a native dependency such as node-pty — therefore failed through both the CLI and the [desktop installer](2026-08-15-desktop-plugin-installation.md), surfacing only a generic `pnpm failed` line. The fix required hand-editing the profile's `pnpm-workspace.yaml`, re-asking per package a trust question the user already answered by submitting the install: the install surface states that plugins execute local code and must come from trusted sources, so submission is the trust decision. A git plugin's `allowBuilds` key also embeds the resolved commit URL, so every update invalidated the manual entry.

## Decision

`dsh plugin` (`apps/cli/src/plugin.ts`) captures each pnpm attempt's output instead of inheriting stdio, echoes it to the caller, and on failure scans it for allowlist blocks: the example key under `allowBuilds:` in the git-prepare error and the comma-separated `name@version` list in the ignored-builds error. Named keys merge into the profile's `allowBuilds`, and pnpm's own pending placeholders (`<name>: set this to true or false`, which pnpm writes into the workspace file on an ignored-builds failure) flip to `true`; a user-set explicit `false` is never flipped. The install then retries, up to three rounds — a git plugin typically needs two, its prepare script first and native transitive dependencies after. A round that approves nothing is a genuine failure (resolution, compatibility, network) and surfaces pnpm's diagnostics unchanged. Each auto-approval prints one stderr line naming the approved keys, so the consent trail stays in the transcript. The git-spec failure hint now also recognizes bare `https://github.com/<owner>/<repo>` URLs.

## Alternatives considered

- **Keep the manual `allowBuilds` step**: rejected because it re-asks a settled trust question once per package (and once per update, through the commit-pinned key), while the UI surfaced no actionable diagnostic.
- **Prompt for build approval inside the installer UI**: rejected because it duplicates the consent the submission already expressed — a second dialog with one sane answer.
- **Version-pinned keys only**: rejected in favor of also flipping pnpm's name-only placeholders, so registry native dependencies keep their approval across version bumps; git keys keep pnpm's commit-pinned spelling because pnpm names them that way, and the retry simply approves the new key on update.
- **Leave output on `stdio: 'inherit'`**: rejected because scanning a failed attempt requires captured output; the echo preserves the observable stream for the terminal and the installer's bounded capture.

## Consequences

- Installing a git plugin or one with native build scripts succeeds in one submission; only hard failures (unresolvable spec, incompatibility, network) block an install.
- The installed package tree's build scripts run under the user's install-time trust, now machine-mediated instead of manual — the trust scope is unchanged: exactly what the submitted install pulls in.
- The profile's `pnpm-workspace.yaml` accumulates `allowBuilds` entries, mixing commit-pinned git keys and name-only registry keys; stale entries are inert.
- Plugin updates that change a git commit URL trigger one more auto-approval round instead of a manual edit.

## Testing

`apps/cli/tests/plugin.spec.ts` drives `runPlugin` against a scripted fake pnpm through both allowlist error shapes plus the placeholder flip, genuine-failure passthrough without `allowBuilds` edits, and `DSH_PNPM_ENTRY` validation. During development, a real-network install of a git plugin with a node-pty dependency was run end-to-end against the bundled pnpm 11.7.0 entry.
