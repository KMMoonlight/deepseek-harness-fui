# Agent Note: Hermetic packaged-desktop plugin installs

Status: implemented

English | [中文](2026-08-17-hermetic-desktop-plugin-installs.zh.md)

## Problem

Installing a plugin from the packaged DeepSeek FUI desktop must succeed on a machine with no development toolchain: no Node, no pnpm, no git, and no Xcode Command Line Tools. The [packaged runtime decision](2026-08-15-electron-fui-desktop-runtime.md) already ships the pieces — Electron as the Node runtime, a bundled pnpm entry forwarded through `DSH_PNPM_ENTRY` — but three gaps broke the chain end to end when installing `dsh-better-sidebar`. pnpm running under the Electron executable leaves lifecycle scripts without `node` or `pnpm` on PATH, so a git plugin's prepare step fails with `sh: pnpm: command not found`. pnpm 11's default 24-hour minimum release age rejects plugins whose dependency closure includes packages published within a day, and its virtual-store migration after a pnpm upgrade prompts interactively and aborts a non-TTY spawn. pnpm also resolves `https://github.com/...` specs through `git ls-remote`, which a fresh macOS only stubs behind a Command Line Tools prompt.

## Decision

Packaged runs (`electronRunAsNode`) regenerate a `node`/`pnpm` wrapper pair over the application binary into `~/.dsh/desktop-tools` on every launch and prepend that directory to the Host's PATH (`apps/desktop/src/pnpm-shims.ts`); development runs keep the developer's own toolchain. The profile workspace template (`packages/boot/app-boot/src/profile.ts`) disables `minimumReleaseAge` and `confirmModulesPurge`: the profile is the user's own trust boundary, and submitting the install is already the trust decision `dsh plugin` documents. `dsh plugin` (`apps/cli/src/plugin.ts`) pins `github.com` and `github:` specs to a commit over the GitHub API and rewrites them to pinned codeload tarball URLs, so git is never invoked; an exact 40-hex ref skips the API round-trip, `GH_TOKEN` rides along when set, and an API failure passes the original spec to pnpm unchanged. `blockedBuildKeys` also parses the pnpm-10 `onlyBuiltDependencies` example list, so one automatic retry converges on both pnpm major lines, each in the key form the version that printed it accepts back.

## Verification

CLI specs pin the tarball rewrite (API answer, 40-hex skip, offline passthrough) and both allowlist output formats through the scripted fake pnpm entry. Desktop specs pin the POSIX and cmd wrapper contents, quoting, exec bits, and stale-wrapper replacement. Profile specs pin the two new workspace settings.

## Alternatives considered

**Require a system Node/pnpm/git with a loud preflight.** Rejected: the point of a packaged application is zero-setup installs, and the failure mode — a Command Line Tools dialog on first `git` — is unrecoverable for normal users.

**Bundle a real pinned Node runtime and run pnpm under it.** Rejected for now: Electron already carries a Node 24 with native TypeScript support, so wrappers over the application binary cost bytes where a real runtime costs about 50 MB per platform. Revisit when a plugin needs to compile native modules against Node headers the Electron ABI lacks.

**Restrict the GUI to npm-registry specs.** Rejected: GitHub repositories are the primary plugin distribution channel; API pinning keeps them while dropping the git requirement.

**Normalize pnpm's printed allowBuilds keys to bare package names.** Rejected: pnpm 11 matches git dependencies only by the exact `name@tarball-url` depPath it prints, while pnpm 10 matches bare names, so each printed form is copied verbatim per format instead of inventing a third one.

## Consequences

- Packaged users install GitHub and registry plugins with only `/bin/sh` from the system; Node, pnpm, and git never come from the host machine.
- The GitHub API pin adds one network round-trip per install and records pinned tarball URLs in the profile manifest; `dsh plugin update` re-resolves HEAD through the same path.
- Plugins whose native dependencies lack N-API prebuilds still need a local compiler; that is a plugin-ecosystem constraint, not an install-chain one.
- The `desktop-tools` wrappers are regenerated each launch, so an updated or relocated application bundle never leaves stale shims behind.
