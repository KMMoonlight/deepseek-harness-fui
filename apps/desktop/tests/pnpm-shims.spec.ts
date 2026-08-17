import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writePnpmShims } from '../src/pnpm-shims.ts'

const homes: string[] = []

function tmp(): string {
  const home = mkdtempSync(join(tmpdir(), 'dsh-pnpm-shims-'))
  homes.push(home)
  return home
}

afterEach(() => {
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

describe('writePnpmShims', () => {
  it('writes POSIX wrappers over the Electron executable with exec bits', () => {
    const dir = tmp()
    writePnpmShims(dir, { nodeExecutable: '/Applications/DeepSeek FUI.app/Contents/MacOS/DeepSeek FUI', pnpmEntry: '/host/pnpm/bin/pnpm.cjs' }, 'darwin')

    const node = readFileSync(join(dir, 'node'), 'utf8')
    expect(node).toContain('ELECTRON_RUN_AS_NODE=1')
    expect(node).toContain('\'/Applications/DeepSeek FUI.app/Contents/MacOS/DeepSeek FUI\'')
    const pnpm = readFileSync(join(dir, 'pnpm'), 'utf8')
    expect(pnpm).toContain('\'/host/pnpm/bin/pnpm.cjs\'')
    for (const name of ['node', 'pnpm']) {
      expect(statSync(join(dir, name)).mode & 0o111).not.toBe(0)
    }
  })

  it('quotes executable paths containing single quotes', () => {
    const dir = tmp()
    writePnpmShims(dir, { nodeExecutable: '/opt/app\'s/electron', pnpmEntry: '/pnpm.cjs' }, 'darwin')

    const node = readFileSync(join(dir, 'node'), 'utf8')
    // The wrapper must shell-quote the apostrophe: '/opt/app'\''s/electron'.
    expect(node).toContain('\'/opt/app\'\\\'\'s/electron\'')
  })

  it('writes cmd wrappers on Windows', () => {
    const dir = tmp()
    writePnpmShims(dir, { nodeExecutable: 'C:\\FUI\\DeepSeek FUI.exe', pnpmEntry: 'C:\\host\\pnpm\\bin\\pnpm.cjs' }, 'win32')

    const node = readFileSync(join(dir, 'node.cmd'), 'utf8')
    expect(node).toContain('set ELECTRON_RUN_AS_NODE=1')
    expect(node).toContain('"C:\\FUI\\DeepSeek FUI.exe" %*')
    const pnpm = readFileSync(join(dir, 'pnpm.cmd'), 'utf8')
    expect(pnpm).toContain('"C:\\FUI\\DeepSeek FUI.exe" "C:\\host\\pnpm\\bin\\pnpm.cjs" %*')
    expect(existsSync(join(dir, 'node'))).toBe(false)
  })

  it('replaces stale wrappers from a previous application path', () => {
    const dir = tmp()
    writePnpmShims(dir, { nodeExecutable: '/old/electron', pnpmEntry: '/old/pnpm.cjs' }, 'darwin')
    writePnpmShims(dir, { nodeExecutable: '/new/electron', pnpmEntry: '/new/pnpm.cjs' }, 'darwin')

    expect(readFileSync(join(dir, 'node'), 'utf8')).toContain("'/new/electron'")
  })
})
