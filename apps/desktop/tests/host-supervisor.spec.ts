import { spawn } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createHostSupervisor,
  createReadinessParser,
  type HostChild,
} from '../src/host-supervisor.ts'

vi.mock('node:child_process', { spy: true })

type HostExitListener = Parameters<HostChild['onExit']>[0]
type HostExitSignal = Parameters<HostExitListener>[1]

class FakeOutput {
  private readonly listeners = new Set<(chunk: string) => void>()

  onData(listener: (chunk: string) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  emit(chunk: string): void {
    for (const listener of this.listeners) listener(chunk)
  }
}

class FakeHostChild implements HostChild {
  readonly pid = 123
  readonly stdout = new FakeOutput()
  readonly stderr = new FakeOutput()
  readonly signals: Array<'SIGTERM' | 'SIGKILL'> = []
  private readonly exitListeners = new Set<HostExitListener>()
  private readonly errorListeners = new Set<(error: Error) => void>()

  onExit(listener: HostExitListener): () => void {
    this.exitListeners.add(listener)
    return () => { this.exitListeners.delete(listener) }
  }

  onError(listener: (error: Error) => void): () => void {
    this.errorListeners.add(listener)
    return () => { this.errorListeners.delete(listener) }
  }

  kill(signal: 'SIGTERM' | 'SIGKILL'): void {
    this.signals.push(signal)
  }

  emitExit(code: number | null = 0, signal: HostExitSignal = null): void {
    for (const listener of this.exitListeners) listener(code, signal)
  }

  emitError(error: Error): void {
    for (const listener of this.errorListeners) listener(error)
  }
}

function observeSettlement<T>(promise: Promise<T>): ReturnType<typeof vi.fn> {
  const settled = vi.fn()
  void promise.then(settled, settled)
  return settled
}

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('desktop Host readiness', () => {
  it('extracts the canonical URL from arbitrarily chunked output', () => {
    const parser = createReadinessParser()

    expect(parser.push('Node warning: see https://nodejs.org/docs\n')).toBeUndefined()
    expect(parser.push('dsh we')).toBeUndefined()
    expect(parser.push('b: http://127.0.')).toBeUndefined()
    expect(parser.push('0.1:4173 (LAN: http://192.0.2.10:4173)')).toBeUndefined()
    expect(parser.push('\nstartup complete\n')).toBe('http://127.0.0.1:4173')
    expect(parser.finalize()).toBe('http://127.0.0.1:4173')
  })

  it.each([
    'dsh web: https://127.0.0.1:4173',
    'dsh web: http://0.0.0.0:4173',
    'dsh web: http://127.0.0.1:0',
    'dsh web: http://127.0.0.1:65536',
    'dsh web: http://127.0.0.1:not-a-port',
  ])('rejects an invalid readiness line: %s', (line) => {
    expect(() => createReadinessParser().push(`${line}\n`)).toThrow(/readiness/iu)
  })

  it('rejects conflicting readiness URLs', () => {
    const parser = createReadinessParser()
    expect(parser.push('dsh web: http://127.0.0.1:4173\n')).toBe('http://127.0.0.1:4173')
    expect(() => parser.push('dsh web: http://127.0.0.1:4174\n')).toThrow(/conflicting readiness URLs/iu)
  })
})

describe('desktop Host supervisor', () => {
  it('starts one child for concurrent callers', async () => {
    const child = new FakeHostChild()
    const spawnHost = vi.fn(() => child)
    const supervisor = createHostSupervisor({ spawnHost })

    const first = supervisor.start()
    expect(supervisor.start()).toBe(first)
    expect(spawnHost).toHaveBeenCalledOnce()

    child.stdout.emit('dsh web: http://127.0.0.1:4567\n')
    await expect(first).resolves.toBe('http://127.0.0.1:4567')
  })

  it('reports bounded output when the Host exits before readiness', async () => {
    const child = new FakeHostChild()
    const supervisor = createHostSupervisor({ spawnHost: () => child })
    const starting = supervisor.start()

    child.stderr.emit('configuration rejected\n')
    child.emitExit(7)

    await expect(starting).rejects.toThrow(/exited before readiness \(code 7, signal null\).*configuration rejected/su)
  })

  it('contains synchronous and asynchronous spawn failures', async () => {
    const synchronous = createHostSupervisor({
      spawnHost: () => { throw new Error('spawn unavailable') },
    })
    await expect(synchronous.start()).rejects.toThrow('spawn unavailable')

    const child = new FakeHostChild()
    const asynchronous = createHostSupervisor({ spawnHost: () => child })
    const starting = asynchronous.start()
    child.emitError(new Error('permission denied'))
    await expect(starting).rejects.toThrow('desktop Host failed to spawn: permission denied')
  })

  it('times out startup and terminates the unready child', async () => {
    vi.useFakeTimers()
    const child = new FakeHostChild()
    const supervisor = createHostSupervisor({ spawnHost: () => child, readinessTimeoutMs: 25 })
    const starting = supervisor.start()
    const rejected = expect(starting).rejects.toThrow('desktop Host readiness timed out after 25ms')

    await vi.advanceTimersByTimeAsync(25)
    await rejected
    expect(child.signals).toEqual(['SIGTERM'])
  })

  it('reports a ready Host exit only outside owned shutdown', async () => {
    const child = new FakeHostChild()
    const onUnexpectedExit = vi.fn()
    const supervisor = createHostSupervisor({ spawnHost: () => child, onUnexpectedExit })
    const starting = supervisor.start()
    child.stdout.emit('dsh web: http://127.0.0.1:4567\n')
    await starting

    child.emitExit(9)
    expect(onUnexpectedExit).toHaveBeenCalledWith({ code: 9, signal: null })
  })

  it('coalesces shutdown and escalates a stuck child once', async () => {
    vi.useFakeTimers()
    const child = new FakeHostChild()
    const supervisor = createHostSupervisor({ spawnHost: () => child, shutdownTimeoutMs: 25 })
    const starting = supervisor.start()
    child.stdout.emit('dsh web: http://127.0.0.1:4567\n')
    await starting

    const first = supervisor.shutdown()
    expect(supervisor.shutdown()).toBe(first)
    const settled = observeSettlement(first)
    expect(child.signals).toEqual(['SIGTERM'])

    await vi.advanceTimersByTimeAsync(25)
    expect(child.signals).toEqual(['SIGTERM', 'SIGKILL'])
    expect(settled).not.toHaveBeenCalled()
    child.emitExit(null, 'SIGKILL')
    await vi.advanceTimersByTimeAsync(0)
    await expect(first).resolves.toBeUndefined()
  })
})

describe('desktop Host process', () => {
  it('boots the FUI profile through packaged Electron Node mode', async () => {
    const spawned = {
      stdout: { on: vi.fn(), off: vi.fn() },
      stderr: { on: vi.fn(), off: vi.fn() },
      on: vi.fn(),
      off: vi.fn(),
      kill: vi.fn(),
    }
    vi.mocked(spawn).mockReturnValue(spawned as never)

    const { spawnDshFui } = await import('../src/host-supervisor.ts')
    spawnDshFui({
      nodeExecutable: '/Applications/DeepSeek FUI.app/Contents/MacOS/DeepSeek FUI',
      cliEntry: '/Applications/DeepSeek FUI.app/Contents/Resources/host/node_modules/@deepseek-ai/dsh/lib/bin.js',
      cwd: '/Users/tester',
      env: { DSH_DESKTOP: '1', DSH_PNPM_ENTRY: '/Resources/host/node_modules/pnpm/bin/pnpm.cjs' },
      electronRunAsNode: true,
    })

    expect(spawn).toHaveBeenCalledWith(
      '/Applications/DeepSeek FUI.app/Contents/MacOS/DeepSeek FUI',
      [
        '--expose-internals',
        expect.stringContaining('/Resources/host/node_modules/@deepseek-ai/dsh/lib/bin.js'),
        '--profile',
        'fui',
        '--host',
        '127.0.0.1',
        '--port',
        '0',
      ],
      expect.objectContaining({
        env: {
          DSH_DESKTOP: '1',
          DSH_PNPM_ENTRY: '/Resources/host/node_modules/pnpm/bin/pnpm.cjs',
          ELECTRON_RUN_AS_NODE: '1',
        },
      }),
    )
  })
})
