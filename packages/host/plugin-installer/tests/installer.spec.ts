import { PassThrough } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SubprocessRuntime } from '@deepseek-ai/dsh-subprocess'
import type {
  SubprocessHandle,
  SubprocessOutputRead,
  SubprocessSpawnSpec,
  SubprocessTerminalHandle,
  SubprocessTerminalSpawnSpec,
} from '@deepseek-ai/dsh-subprocess'
import { remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import PluginInstallerGateway, { type Config } from '../src/index.ts'

interface FakeRun {
  readonly done: Promise<{ exitCode: number | null; signal: NodeJS.Signals | null }>
  readonly stdout?: string
  readonly stderr?: string
  readonly lossy?: boolean
  readonly settleOnAbort?: boolean
}

class FakeSubprocessRuntime extends SubprocessRuntime {
  readonly specs: SubprocessSpawnSpec[] = []
  runs: FakeRun[] = []
  spawnError: unknown

  async resolveExecutable(command: string): Promise<string> {
    return command
  }

  spawn(spec: SubprocessSpawnSpec): SubprocessHandle {
    this.specs.push(spec)
    if (this.spawnError !== undefined) throw this.spawnError
    const run = this.runs.shift() ?? { done: Promise.resolve({ exitCode: 0, signal: null }) }
    let done = run.done
    if (run.settleOnAbort && spec.signal !== undefined) {
      const aborted = Promise.withResolvers<{ exitCode: null; signal: 'SIGTERM' }>()
      spec.signal.addEventListener('abort', () => { aborted.resolve({ exitCode: null, signal: 'SIGTERM' }) }, { once: true })
      done = Promise.race([done, aborted.promise])
    }
    const read = (text: string | undefined): SubprocessOutputRead => ({
      text: text ?? '', nextOffset: Buffer.byteLength(text ?? ''), lossy: run.lossy ?? false,
    })
    return {
      pid: 42,
      stdin: undefined,
      stdout: undefined,
      stderr: undefined,
      collected: {
        stdout: { readFrom: () => read(run.stdout) },
        stderr: { readFrom: () => read(run.stderr) },
      },
      done,
      terminate: () => {},
      waitForExit: async () => true,
    }
  }

  async spawnTerminal(_spec: SubprocessTerminalSpawnSpec): Promise<SubprocessTerminalHandle> {
    return {
      pid: 1,
      output: new PassThrough(),
      done: Promise.resolve({ exitCode: 0, signal: null }),
      write: async () => {},
      inspectForeground: async () => undefined,
      signalForeground: async () => 1,
      terminate: async () => {},
    }
  }
}

const contexts: Context[] = []
const originalDesktop = process.env.DSH_DESKTOP
const originalPnpmEntry = process.env.DSH_PNPM_ENTRY

beforeEach(() => {
  process.env.DSH_DESKTOP = '1'
  process.env.DSH_PNPM_ENTRY = '/opt/dsh/pnpm.cjs'
})

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  if (originalDesktop === undefined) delete process.env.DSH_DESKTOP
  else process.env.DSH_DESKTOP = originalDesktop
  if (originalPnpmEntry === undefined) delete process.env.DSH_PNPM_ENTRY
  else process.env.DSH_PNPM_ENTRY = originalPnpmEntry
  vi.useRealTimers()
})

async function harness(overrides: Partial<Config> = {}) {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(FakeSubprocessRuntime)
  const fiber = ctx.plugin(PluginInstallerGateway, {
    cliEntry: process.execPath,
    profile: 'fui',
    timeoutMs: 1_000,
    maxOutputBytes: 256,
    graceMs: 25,
    maxSpecChars: 80,
    ...overrides,
  })
  await fiber.await()
  return {
    ctx,
    fiber,
    subprocess: ctx.subprocess as FakeSubprocessRuntime,
    installer: ctx.get('pluginInstaller') as PluginInstallerGateway,
  }
}

describe('PluginInstallerGateway', () => {
  it('publishes one cancellable direct add method', async () => {
    const { installer } = await harness()
    expect(installer.typertRemote).toMatchObject({ serviceKey: 'pluginInstaller', namespace: 'pluginInstaller' })
    expect(remoteMethods(installer)).toEqual([{
      method: 'install',
      exportName: 'add',
      invocation: { kind: 'direct' },
    }])
  })

  it('runs the existing profile command as one managed argv and returns bounded diagnostics', async () => {
    const { installer, subprocess } = await harness()
    subprocess.runs.push({
      done: Promise.resolve({ exitCode: 0, signal: null }),
      stdout: 'installed\n',
      stderr: 'warning\n',
      lossy: true,
    })
    await expect(installer.install({ spec: '  @scope/example@latest  ' }, new AbortController().signal)).resolves.toEqual({
      ok: true,
      value: {
        spec: '@scope/example@latest',
        restartRequired: true,
        stdout: '[earlier output truncated]\ninstalled\n',
        stderr: '[earlier output truncated]\nwarning\n',
      },
    })
    expect(subprocess.specs[0]).toMatchObject({
      argv: [
        process.execPath,
        '--expose-internals',
        process.execPath,
        'plugin',
        '--profile',
        'fui',
        'add',
        '--',
        '@scope/example@latest',
      ],
      cwd: process.cwd(),
      stdio: { stdin: 'ignore', stdout: { maxBytes: 256 }, stderr: { maxBytes: 256 } },
      graceMs: 25,
      env: { DSH_PNPM_ENTRY: '/opt/dsh/pnpm.cjs' },
    })
  })

  it('rejects malformed single-argument specs before spawning', async () => {
    const { installer, subprocess } = await harness({ maxSpecChars: 5 })
    for (const spec of ['', '      ', '--global', 'a b', 'abcdef']) {
      await expect(installer.install({ spec }, new AbortController().signal))
        .resolves.toMatchObject({ ok: false, error: { code: 'invalid-spec' } })
    }
    expect(subprocess.specs).toHaveLength(0)
  })

  it('rejects concurrent profile mutations instead of racing pnpm', async () => {
    const { installer, subprocess } = await harness()
    const pending = Promise.withResolvers<{ exitCode: number; signal: null }>()
    subprocess.runs.push({ done: pending.promise })
    const first = installer.install({ spec: 'first' }, new AbortController().signal)
    await expect(installer.install({ spec: 'second' }, new AbortController().signal)).resolves.toEqual({
      ok: false,
      error: { code: 'busy', message: 'Another plugin installation is already running.' },
    })
    pending.resolve({ exitCode: 0, signal: null })
    await expect(first).resolves.toMatchObject({ ok: true })
  })

  it('returns stable start, close, exit, and timeout failures', async () => {
    const start = await harness()
    start.subprocess.spawnError = new Error('permission denied')
    await expect(start.installer.install({ spec: 'pkg' }, new AbortController().signal)).resolves.toEqual({
      ok: false, error: { code: 'install-failed', message: 'permission denied' },
    })

    const nonErrorStart = await harness()
    nonErrorStart.subprocess.spawnError = 'no process'
    await expect(nonErrorStart.installer.install({ spec: 'pkg' }, new AbortController().signal)).resolves.toEqual({
      ok: false, error: { code: 'install-failed', message: 'Plugin process failed to start.' },
    })

    const close = await harness()
    close.subprocess.runs.push({ done: Promise.reject(new Error('closed badly')) })
    await expect(close.installer.install({ spec: 'pkg' }, new AbortController().signal)).resolves.toEqual({
      ok: false, error: { code: 'install-failed', message: 'closed badly' },
    })

    const exit = await harness()
    exit.subprocess.runs.push({
      done: Promise.resolve({ exitCode: 7, signal: null }), stdout: 'out', stderr: 'bad',
    })
    await expect(exit.installer.install({ spec: 'pkg' }, new AbortController().signal)).resolves.toEqual({
      ok: false,
      error: {
        code: 'install-failed',
        message: 'The package manager did not install this plugin.',
        exitCode: 7,
        stdout: 'out',
        stderr: 'bad',
      },
    })

    const timeout = await harness({ timeoutMs: 1 })
    timeout.subprocess.runs.push({ done: new Promise(() => {}), settleOnAbort: true })
    await expect(timeout.installer.install({ spec: 'pkg' }, new AbortController().signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'timed-out', exitCode: null },
    })
  })

  it('threads request cancellation and service teardown into the managed process', async () => {
    const alreadyCancelled = await harness()
    const alreadyCancelledController = new AbortController()
    alreadyCancelledController.abort()
    await expect(alreadyCancelled.installer.install({ spec: 'pkg' }, alreadyCancelledController.signal))
      .rejects.toThrow('This operation was aborted')

    const cancelled = await harness()
    cancelled.subprocess.runs.push({ done: new Promise(() => {}), settleOnAbort: true })
    const controller = new AbortController()
    const operation = cancelled.installer.install({ spec: 'pkg' }, controller.signal)
    controller.abort('left page')
    await expect(operation).rejects.toThrow('left page')

    const unloading = await harness()
    unloading.subprocess.runs.push({ done: new Promise(() => {}), settleOnAbort: true })
    const active = unloading.installer.install({ spec: 'pkg' }, new AbortController().signal)
    await unloading.fiber.dispose()
    await expect(active).rejects.toThrow('service is unloading')
  })

  it('fails load outside the desktop Host or with a non-existent CLI entry', async () => {
    delete process.env.DSH_DESKTOP
    const outside = new Context()
    contexts.push(outside)
    new FakeSubprocessRuntime(outside)
    expect(() => new PluginInstallerGateway(outside, {
      cliEntry: process.execPath,
      profile: 'fui', timeoutMs: 1, maxOutputBytes: 1, graceMs: 1, maxSpecChars: 1,
    })).toThrow('only load inside the desktop Host')

    process.env.DSH_DESKTOP = '1'
    for (const cliEntry of ['relative.js', '/definitely/missing/dsh-cli.js']) {
      const invalid = new Context()
      contexts.push(invalid)
      new FakeSubprocessRuntime(invalid)
      expect(() => new PluginInstallerGateway(invalid, {
        cliEntry,
        profile: 'fui', timeoutMs: 1, maxOutputBytes: 1, graceMs: 1, maxSpecChars: 1,
      })).toThrow('must name an existing absolute dsh CLI entry')
    }
  })
})
