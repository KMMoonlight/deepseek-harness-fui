# Agent Note: Remove the Appearance settings row

Status: implemented

English | [中文](2026-08-15-remove-appearance-settings-row.zh.md)

## Problem

The shipped FUI surface has one fixed cyan dark palette. Product Settings nevertheless presented Light, Dark, and System cubes as three visible choices. All three landed on the same FUI palette, so the row promised a visual change it could not deliver and consumed a large rectangular block in the General page.

ThemeRuntime still serves non-Settings roles. It resolves Host theme values during startup, preserves the stock surface's light/dark semantics, publishes snapshots to the layout presenter, and supports registered token overrides and extension consumers. Removing that runtime together with the misleading row would break those separate responsibilities.

## Decision

ui-theme no longer registers an `appearance` contribution in `settings.general.item`. The package drops the row component, row store, icons, localized copy, CSS, tests, React dependencies, and slot/locale dependencies that existed only for that contribution. Product Settings exposes no Appearance label or Light, Dark, and System controls.

ThemeRuntime, the `ui-theme.preference` Host schema, bootstrap injection, `ThemeSnapshot`, `setTheme`, the token registry, and the layout presenter remain. Existing durable values are still adopted, and programmatic consumers may still write built-in preferences, but the first-party settings surface provides no write path. The [Host-backed preferences decision](../bug-fix/2026-08-06-host-backed-web-preferences.md) continues to own persistence, while this note supersedes the Appearance-row part of the [client Settings proposal](../../proposed/architecture/2026-07-25-client-settings-locale-theme.md).

## Verification

The assembled Settings scenario asserts that the Appearance label and all three controls are absent and records the resulting General-page accessibility snapshot. The assembled FUI surface scenario independently asserts the English selector is absent. ui-theme unit tests retain coverage for immediate service provision, Host preference adoption, reconnect refresh, remote memory mode, slow initial reads, and invalid wire values. The generated client slot catalog has no ui-theme occupant under `settings.general.item`.

## Alternatives considered

**Hide the row only in FUI CSS.** Rejected because the contribution and its accessible controls would still exist, the slot ledger would retain a ghost occupant, and non-FUI product entry points would continue advertising a choice the product does not support.

**Delete ThemeRuntime and all theme settings.** Rejected because startup bootstrap, stock-surface semantics, layout presentation, token inspection, and extension consumers remain active contracts independent of the Product Settings row.

**Move the selector into an opt-in plugin.** Rejected because no shipped product surface supplies distinct palettes for such a selector. A dormant package would preserve code and dependencies without a user-visible capability.

## Consequences

The General page is shorter and presents only settings with observable outcomes. A stored Host theme value can still affect the stock surface and startup behavior, but users cannot change it through Product Settings. Reintroducing a user-facing theme selector requires at least two genuinely distinct shipped palettes and a feature-owned settings contribution with assembled interaction coverage.
