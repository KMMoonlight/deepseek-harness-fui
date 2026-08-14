# Agent Note: Desktop creates the webview at the backend URL

Status: implemented

English | [中文](2026-08-14-desktop-final-url-window-creation.zh.md)

## Problem

On macOS, the desktop application created its configured main webview at a bundled placeholder and synchronously started the backend during Tauri setup. When the backend became ready, setup called `navigate()` on that existing webview. WebKit could still be resolving the initial navigation policy, and the second navigation emitted a native stack ending in `WebFramePolicyListenerProxy::ignore(WebKit::WasNavigationIntercepted)`. The backend and application remained usable, but every development launch looked like a native failure and the ordering depended on WebKit timing.

## Decision

The Tauri configuration declares no main window. Setup starts the owned backend, waits for its printed loopback URL, then creates `main` with `WebviewWindowBuilder` and `WebviewUrl::External`. The webview's first request is the final backend URL, so no second navigation competes with the initial WebKit policy decision.

Window title, initial size, minimum size, FUI background color, single-instance handling, tray behavior, window-state persistence, and process-group cleanup remain owned by the desktop process. A backend startup failure exits before a webview exists and reports the retained stderr tail.

## Verification

A macOS startup regression runs the real Tauri application through the backend readiness line, keeps it alive beyond window creation, and scans its output for `WasNavigationIntercepted` and `WebFramePolicyListenerProxy::ignore`. The same command reproduced the stack before this decision and exits cleanly without either marker after it. Rust compilation and tests cover the remaining process selection and lifecycle helpers.

## Alternatives considered

- **Keep the placeholder and call `navigate()` later**: rejected because the observed failure is the ordering between the initial policy decision and that second navigation; adding an arbitrary delay would retain the race.
- **Let placeholder JavaScript redirect after polling readiness**: rejected because it adds a browser-to-native readiness channel and still performs a second navigation without improving failure reporting.
- **Suppress the native stack**: rejected because filtering stderr would hide other WebKit diagnostics and leave the timing defect intact.
- **Serve the placeholder from the backend**: rejected because no placeholder is useful after the backend is ready, and a failed backend cannot serve one.

## Consequences

- The desktop window appears only after the backend reports readiness. There is no native loading screen during startup.
- Backend failure produces terminal diagnostics without flashing an empty window.
- WebKit receives one application navigation, removing the intercepted-navigation stack without changing the loopback transport or backend lifetime.
- A packaged application still needs the documented Node sidecar and native startup-failure dialog.
