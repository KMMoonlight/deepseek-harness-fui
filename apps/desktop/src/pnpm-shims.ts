/**
 * PATH shims that give pnpm lifecycle scripts a `node` and a `pnpm` when the
 * package manager itself runs under the desktop app's Electron executable in
 * Node mode. `process.execPath` then names the app binary, so a git plugin's
 * prepare step — which shells out to `pnpm install` and to `#!/usr/bin/env
 * node` tools — would find neither command on a PATH that only carries the
 * system directories. The desktop app regenerates these wrappers into a
 * user-writable directory on every launch and prepends that directory to the
 * Host's PATH.
 * @module @deepseek-ai/dsh-desktop/pnpm-shims
 */

import { chmodSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Shell-quote one POSIX path for a `/bin/sh` one-liner. */
function quoteSh(value: string): string {
  return `'${value.replaceAll('\'', '\'\\\'\'')}'`
}

/**
 * Write `node` and `pnpm` wrappers into `dir` that delegate to `nodeExecutable`.
 * The wrappers set `ELECTRON_RUN_AS_NODE` themselves, so they stay correct
 * regardless of the invoking process's own mode. Existing files are replaced
 * to track an updated application path.
 * @param dir - the directory that will lead the Host's PATH.
 * @param options - the Electron executable and the bundled pnpm entry it runs.
 * @param platform - the target platform (test seam; defaults to the host).
 */
export function writePnpmShims(
  dir: string,
  options: { readonly nodeExecutable: string; readonly pnpmEntry: string },
  platform: NodeJS.Platform = process.platform,
): void {
  mkdirSync(dir, { recursive: true })
  if (platform === 'win32') {
    writeFileSync(join(dir, 'node.cmd'), `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${options.nodeExecutable}" %*\r\n`)
    writeFileSync(join(dir, 'pnpm.cmd'), `@echo off\r\nset ELECTRON_RUN_AS_NODE=1\r\n"${options.nodeExecutable}" "${options.pnpmEntry}" %*\r\n`)
    return
  }
  writeFileSync(join(dir, 'node'), `#!/bin/sh\nexec env ELECTRON_RUN_AS_NODE=1 ${quoteSh(options.nodeExecutable)} "$@"\n`)
  writeFileSync(join(dir, 'pnpm'), `#!/bin/sh\nexec env ELECTRON_RUN_AS_NODE=1 ${quoteSh(options.nodeExecutable)} ${quoteSh(options.pnpmEntry)} "$@"\n`)
  chmodSync(join(dir, 'node'), 0o755)
  chmodSync(join(dir, 'pnpm'), 0o755)
}
