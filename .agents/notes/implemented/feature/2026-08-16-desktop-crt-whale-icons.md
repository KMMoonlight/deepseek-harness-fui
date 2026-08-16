# Agent Note: Desktop icon set generated from the FUI whale mark

Status: implemented

English | [中文](2026-08-16-desktop-crt-whale-icons.zh.md)

## Problem

The desktop shell shipped a placeholder `resources/icon.png` (a green square outline), so packaged builds had no product identity and development runs showed Electron's own Dock icon — nothing ever called `app.dock.setIcon`. The same placeholder fed the tray: squeezed to 18px and converted to a macOS template image, the thin outline read as a blank menu-bar square.

## Decision

`apps/desktop/scripts/build-icons.ts` renders the icon set from the FishLogo whale path, extracted from the ui-primitives source at run time so the artwork tracks the product logo. The app icon strokes the whale outline in FUI phosphor green with a glow pass and scanlines over the deep-navy rounded plate (CRT line treatment); the tray glyph is the solid silhouette — black template artwork with a retina representation on macOS, FUI green on Windows/Linux where template inversion does not exist. Headless Chromium (Playwright) rasterizes the SVGs; the PNGs are committed under `resources/` and re-rendered on demand, keeping the repo free of binary editors while the outputs stay reviewable images. In the main process, `resourcePath()` centralizes staged-resource lookup, `trayImage()` attaches the `@2x` representation and sets the template flag, and `boot()` points the macOS Dock at the icon so development runs carry the product icon too. Packaging stages every `resources/*.png` into `desktop-resources/`.

## Alternatives considered

- **Hand-drawn binary icons**: rejected — unreviewable diffs, and the artwork would drift from the FishLogo source of truth.
- **Reusing the app icon for the tray**: rejected — a 1024px stroked illustration resized to 18px loses the lines; macOS tray artwork must be a template silhouette to survive light and dark menu bars.
- **Shipping an `.icns`**: deferred — electron-builder converts the 1024px PNG for macOS and Windows targets; a checked-in icns adds a binary without buying anything at current fidelity.

## Consequences

- `resources/` now holds `icon.png` (1024²) plus colored and template tray pairs; `pnpm --filter @deepseek-ai/dsh-desktop run build:icons` regenerates all five deterministically.
- `apps/desktop` gains a Playwright devDependency (same spec as `apps/web`) for the generator; the runtime does not load it.
- Dev-mode macOS windows show the FUI icon in the Dock; packaged behavior is unchanged apart from the real artwork.

## Testing

The desktop packaging contract specs pass unchanged; typecheck and the desktop build cover the main-process changes. The generated PNGs are verified by reading the rendered output; the generator is deterministic, so re-running it produces no diff.
