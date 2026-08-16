# Agent Note: Desktop composes independent official DSH with an application FUI overlay

Status: implemented

English | [中文](2026-08-16-independent-official-dsh-desktop-overlay.zh.md)

## Problem

Official `@deepseek-ai/dsh` and the FUI desktop application have independent publishers and release schedules. Requiring one official DSH package to depend on this application's FUI bundle would prevent the desktop from adopting ordinary official features until three artifacts were released together. Updating signed application resources in place is not acceptable, and allowing the renderer to assemble arbitrary package sets would expose excessive process and filesystem authority.

The desktop still needs one bootable composition. An official update may change shared Host, Client, or plugin packages, while the FUI surface, Web assets, and update protocol belong to the installed application. Combining those inputs without an explicit compatibility rule could select an official version that the application overlay cannot load.

## Decision

The desktop declares `dshDesktop.compatibleDsh` as the semver range of official DSH versions supported by its exact FUI release. The runtime updater reads the configured official npm dist-tag and installs a newer exact `@deepseek-ai/dsh` only when it falls inside that range. The range includes prereleases intentionally. A version outside the range is reported as incompatible and leaves the active runtime unchanged.

The updater creates a private project under `$DSH_HOME/desktop-runtime` and installs only the official DSH root with pnpm's hoisted linker. It then copies a fixed list of application-owned FUI packages from immutable application resources into the managed root: the FUI bundle, FUI Client packages, desktop updater halves, and Web frontend. The local managed DSH manifest receives an exact dependency on `@deepseek-ai/dsh-fui-app`, allowing the official profile fallback traversal to discover the overlay. Official packages supply the remaining dependency closure, so non-FUI features follow the selected official release.

The updater Remote is mounted by `dsh-client-ui-settings-runtime-updater` through the generic API Gateway instead of the official `dsh-api-remotes` assembly. This keeps the application protocol in the FUI overlay and preserves Remote contributions added by later compatible official releases.

A managed tree is accepted only when the official package identity and version match, the version satisfies the desktop range, every application overlay package has the exact FUI version and required entry, the patched DSH manifest selects that FUI version, and the CLI reports the requested version. `current.json` records both the official DSH version and FUI version and becomes active only after validation. Electron repeats structural validation before boot, tries the managed Host first, quarantines a rejected pointer or readiness failure, and retains the immutable packaged runtime as fallback. Activation occurs only on a full application restart.

The archived [same-release package-closure design](../../archived/feature/2026-08-16-desktop-managed-runtime-updates.md) remains historical context; this decision supersedes its requirement that official DSH publish the FUI bundle.

## Verification

Host tests cover independent registry metadata, range acceptance and rejection, the hoisted official install command, application-overlay copying, exact overlay validation, local DSH manifest augmentation, CLI smoke, atomic pointer selection, cancellation, timeouts, and quarantine. Electron tests cover application expectations passed into pointer validation and managed-to-bundled fallback. Client tests cover private Remote mounting, displayed DSH/FUI/range facts, update states, cancellation, and localized incompatibility. The assembled desktop FUI acceptance records the settings row through the real Host and Client composition without a registry request.

## Alternatives considered

- **Coordinate official DSH, FUI bundle, and Web frontend releases**: rejected because the projects have independent publishers and ordinary official features should not wait for a desktop release.
- **Replace all application packages with the official closure**: rejected because official DSH does not own or publish this FUI surface and Web frontend.
- **Overlay the complete packaged Harness closure**: rejected because application copies of shared packages would mask the official release's new features.
- **Accept every newer official DSH version**: rejected because breaking API, configuration, or composition changes require an updated FUI overlay.
- **Modify application resources or use a global installation**: rejected because signed resources must remain immutable, icon launch must stay self-contained, and selection needs an atomic fallback.

## Consequences

- Compatible official DSH releases can be installed from the application without a synchronized FUI or desktop release.
- A breaking official change requires a new desktop build that adapts the FUI overlay and revises `dshDesktop.compatibleDsh`.
- The FUI version displayed in Settings is the installed application's version; updating official DSH does not update the FUI surface or Electron shell.
- A later desktop release rejects a pointer carrying a different FUI version and uses its bundled fallback until a compatible managed tree is selected.
- Official updates and third-party profile plugins remain separate operations. Profile data and installed third-party plugins remain under `$DSH_HOME/profiles/fui`.
- The updater adds no model-visible input or Session event.
