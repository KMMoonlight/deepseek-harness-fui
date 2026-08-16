# Agent Note: Settings Updates tab for the official DSH runtime

Status: implemented

English | [中文](2026-08-16-settings-updates-tab.zh.md)

## Problem

The desktop runtime updater surfaced only as a dense "桌面运行时" block inside General settings: it showed three version/range rows and a single "检查并更新" button that checked and installed in one step, so a user who only wanted to know whether an update exists triggered an install. The block also crowded the General page with detail (FUI version, compatibility range) that answers no recurring question.

## Decision

Settings gains a desktop-only **Updates** section (`id: 'updates'`, order 30) contributed by `dsh-client-ui-settings-runtime-updater` through the existing `settings.section` slot; the old General-settings row is removed. The section is deliberately minimal: current version (with its bundled/managed source), latest version, and a **Check for updates** button. An **Update now** button appears only when the check finds a newer, range-compatible release; incompatibility, failure, and restart-required states render as one-line notices.

The Host gateway (`packages/host/runtime-updater`) splits the check half out of the one-click update: a new check-only `@Remote('check')` reuses the registry fetch shared with `update` and returns `{ currentVersion, latestVersion, updateAvailable, compatible }` without touching the filesystem or the serialized install slot. `describe` stays network-free for the initial paint.

FUI self-update is deliberately out of scope: the macOS desktop build is unsigned (Squirrel/electron-updater require signing), and the FUI overlay packages are not published to npm, so the application-owned FUI version can only move with a desktop release. The section therefore shows DSH facts only.

## Alternatives considered

- **Keep the block in General and add the tab as a second surface**: rejected — two owners for one update flow, and the General block's detail rows were the redundancy being removed.
- **One-step check-and-install button only** (the old behavior): rejected — checking must be harmless; installation must be a separate, informed click.
- **Extend the updater to fetch FUI overlay packages from npm**: rejected for now — the overlay packages are unpublished, so the channel could not be exercised end to end; the overlay-source extension can be added when the FUI release process publishes them.
- **electron-updater against GitHub Releases**: rejected — macOS auto-update requires code-signing credentials this repository does not have; it would silently work nowhere on the primary platform.

## Consequences

- Checking is read-only and separate from installing; the latest-version row fills on demand.
- The Remote surface grows by one method (`runtimeUpdater/check`); the generated remote client rebuilds with the normal build.
- General settings loses the desktop-runtime block; the bundle's desktop-only `disabled` gating is unchanged, so plain `dsh --profile fui` in a browser never sees the tab.
- A desktop restart still activates an installed runtime; there is no programmatic relaunch (no IPC channel exists), and the copy says so.

## Testing

Host specs cover the new Remote's available/up-to-date/incompatible/failure shapes and assert no subprocess spawns during a check. Client specs cover the section's render states (unchecked, checked, offered, incompatible, installed, every failure code) and unmount cancellation, and the browser-plugin spec pins the `settings.section` registration, the localized label, and the transport error wrapping. The keyless desktop-composition e2e (`apps/web/tests/desktop-plugin-installation.e2e.ts`) drives the real shell into the Updates tab and its golden pins the minimal section: current version, unchecked latest row, and the check button, with no registry request on mount.
