/**
 * Mark the trusted FUI renderer when Electron overlays native macOS controls.
 * This entry builds as CommonJS because sandboxed Electron preloads do not
 * execute as ES modules.
 */

function markDocument(): void {
  if (process.platform === 'darwin') {
    document.documentElement.setAttribute('data-dsh-native-titlebar', 'macos-overlay')
  }
  document.documentElement.setAttribute('data-dsh-desktop-shell', 'electron')
}

document.addEventListener('DOMContentLoaded', markDocument, { once: true })
