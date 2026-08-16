import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { load } from 'js-yaml'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { runPlugin } from '../src/plugin.ts'

// A fake pnpm entry scripted through FAKE_PNPM_MODE: 'allowlist-then-ok'
// fails twice with the two allowlist shapes pnpm ≥11 prints, then succeeds;
// any other mode fails with a genuine (non-allowlist) registry error.
const FAKE_PNPM_SOURCE = `const { appendFileSync, readFileSync, writeFileSync } = require('node:fs')
const state = process.env.FAKE_PNPM_STATE
const runs = Number(readFileSync(state, 'utf8')) + 1
writeFileSync(state, String(runs))
if (process.env.FAKE_PNPM_MODE === 'allowlist-then-ok') {
  if (runs === 1) {
    process.stderr.write('[ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED] Failed to prepare git-hosted package fetched from "https://codeload.github.com/omdsh-dev/DSH-better-sidebar/tar.gz/abc123": needs to execute build scripts but is not in the "allowBuilds" allowlist.\\n')
    process.stderr.write('Add the package to "allowBuilds" in your project\\'s pnpm-workspace.yaml to allow it to run scripts. For example:\\n')
    process.stderr.write('allowBuilds:\\n  fake-plugin@https://codeload.github.com/omdsh-dev/DSH-better-sidebar/tar.gz/abc123: true\\n')
    process.exit(1)
  }
  if (runs === 2) {
    // pnpm also records the blocked packages in the workspace file itself as
    // pending-approval placeholders (cwd is the profile directory).
    appendFileSync('pnpm-workspace.yaml', '  node-pty: set this to true or false\\n')
    process.stderr.write('[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: node-pty@1.1.0\\n\\nRun "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.\\n')
    process.exit(1)
  }
  process.exit(0)
}
process.stderr.write('[ERR_PNPM_FETCH_404] GET https://registry.npmjs.org/nope: Not Found - 404\\n')
process.exit(1)
`

const homes: string[] = []

interface FakePnpm {
  readonly home: string
  readonly workspaceYaml: string
  readonly runs: () => number
}

function setupFakePnpm(mode: string): FakePnpm {
  const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-'))
  homes.push(home)
  const state = join(home, 'fake-pnpm-runs')
  writeFileSync(state, '0')
  const entry = join(home, 'fake-pnpm.cjs')
  writeFileSync(entry, FAKE_PNPM_SOURCE)
  vi.stubEnv('DSH_HOME', home)
  vi.stubEnv('DSH_PNPM_ENTRY', entry)
  vi.stubEnv('FAKE_PNPM_STATE', state)
  vi.stubEnv('FAKE_PNPM_MODE', mode)
  return {
    home,
    workspaceYaml: join(home, 'profiles', 'plugtest', 'pnpm-workspace.yaml'),
    runs: () => Number(readFileSync(state, 'utf8')),
  }
}

/** Capture everything dsh writes to stderr (its own messages and echoed pnpm output). */
function spyStderr(): () => string {
  const chunks: string[] = []
  vi.spyOn(process.stderr, 'write').mockImplementation((chunk: unknown) => {
    chunks.push(String(chunk))
    return true
  })
  return () => chunks.join('')
}

function readWorkspaceYaml(path: string): Record<string, unknown> {
  return load(readFileSync(path, 'utf8')) as Record<string, unknown>
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  for (const home of homes.splice(0)) rmSync(home, { recursive: true, force: true })
})

describe('dsh plugin', () => {
  it('allows the build scripts pnpm names and retries until the install succeeds', () => {
    const fake = setupFakePnpm('allowlist-then-ok')
    const stderr = spyStderr()

    const exitCode = runPlugin('plugtest', ['add', '--', 'https://github.com/omdsh-dev/DSH-better-sidebar'])

    expect(exitCode).toBe(0)
    expect(fake.runs()).toBe(3)
    const settings = readWorkspaceYaml(fake.workspaceYaml)
    expect(settings.allowBuilds).toEqual({
      'fake-plugin@https://codeload.github.com/omdsh-dev/DSH-better-sidebar/tar.gz/abc123': true,
      // pnpm's pending-approval placeholder, flipped in place.
      'node-pty': true,
      'node-pty@1.1.0': true,
    })
    // The profile template's unrelated settings survive the merge.
    expect(settings.nodeLinker).toBe('hoisted')
    expect(stderr()).toContain('allowed build scripts')
    expect(stderr()).not.toContain('pnpm failed')
  })

  it('surfaces genuine pnpm failures without touching allowBuilds', () => {
    const fake = setupFakePnpm('fail')
    const stderr = spyStderr()

    const exitCode = runPlugin('plugtest', ['add', '--', 'https://github.com/omdsh-dev/DSH-better-sidebar'])

    expect(exitCode).toBe(1)
    expect(fake.runs()).toBe(1)
    expect(readWorkspaceYaml(fake.workspaceYaml).allowBuilds).toBeUndefined()
    expect(stderr()).toContain('pnpm failed in profile directory')
    // A bare https GitHub URL is still recognized as a git spec for the hint.
    expect(stderr()).toContain('allowBuilds')
  })

  it('rejects a DSH_PNPM_ENTRY that is not an existing absolute path', () => {
    const home = mkdtempSync(join(tmpdir(), 'dsh-plugin-'))
    homes.push(home)
    vi.stubEnv('DSH_HOME', home)
    vi.stubEnv('DSH_PNPM_ENTRY', 'relative/pnpm.cjs')
    const stderr = spyStderr()

    expect(runPlugin('plugtest', ['add', 'whatever'])).toBe(127)
    expect(stderr()).toContain('DSH_PNPM_ENTRY must name an existing absolute pnpm JavaScript entry')
  })
})
