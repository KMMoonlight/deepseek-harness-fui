import { PassThrough } from 'node:stream'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
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
import RuntimeUpdaterGateway, { type Config } from '../src/index.ts'
import {
  DSH_DESKTOP_OVERLAY_PACKAGES,
  DSH_FUI_BUNDLE_PACKAGE,
  DSH_RUNTIME_PACKAGE,
  nodeModulesPackageRoot,
  readManagedRuntime,
  type ManagedRuntimeExpectations,
} from '../src/managed-runtime.ts'

const expectations: ManagedRuntimeExpectations = {
  fuiVersion: '7.0.0',
  compatibleDshRange: '>=1.0.0 <2.0.0',
}

const overlayEntries: Readonly<Record<(typeof DSH_DESKTOP_OVERLAY_PACKAGES)[number], string>> = {
  [DSH_FUI_BUNDLE_PACKAGE]: 'cordis.patch.yml',
  '@deepseek-ai/dsh-client-ui-fui': 'lib/index.js',
  '@deepseek-ai/dsh-client-ui-fui-layout': 'lib/client.js',
  '@deepseek-ai/dsh-client-ui-fui-surface': 'lib/client.js',
  '@deepseek-ai/dsh-client-ui-settings-runtime-updater': 'lib/client.js',
  '@deepseek-ai/dsh-host-runtime-updater': 'lib/index.js',
  '@deepseek-ai/dsh-web-frontend': 'dist/index.html',
}

interface FakeRun {
  readonly outcome?: { readonly exitCode: number | null; readonly signal: NodeJS.Signals | null }
  readonly stdout?: string
  readonly stderr?: string
  readonly lossy?: boolean
  readonly settleOnAbort?: boolean
  readonly beforeDone?: (spec: SubprocessSpawnSpec) => Promise<void>
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
    const run = this.runs.shift() ?? {}
    const outcome = run.outcome ?? { exitCode: 0, signal: null }
    let done = (run.beforeDone === undefined
      ? Promise.resolve()
      : run.beforeDone(spec)).then(() => outcome)
    if (run.settleOnAbort && spec.signal !== undefined) {
      const aborted = Promise.withResolvers<{ exitCode: null; signal: 'SIGTERM' }>()
      spec.signal.addEventListener('abort', () => { aborted.resolve({ exitCode: null, signal: 'SIGTERM' }) }, { once: true })
      done = Promise.race([done, aborted.promise])
    }
    const read = (value: string | undefined): SubprocessOutputRead => ({
      text: value ?? '',
      nextOffset: Buffer.byteLength(value ?? ''),
      lossy: run.lossy ?? false,
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
const roots: string[] = []
const originalDesktop = process.env.DSH_DESKTOP

beforeEach(() => {
  process.env.DSH_DESKTOP = '1'
})

afterEach(async () => {
  await Promise.allSettled(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
  await Promise.all(roots.splice(0).map(value => rm(value, { recursive: true, force: true })))
  if (originalDesktop === undefined) delete process.env.DSH_DESKTOP
  else process.env.DSH_DESKTOP = originalDesktop
})

async function tempRoot(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), 'dsh-runtime-gateway-'))
  roots.push(value)
  return value
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

async function writeInstalledTree(root: string, version: string): Promise<void> {
  const packageRoot = nodeModulesPackageRoot(join(root, 'node_modules'), DSH_RUNTIME_PACKAGE)
  await writeJson(join(packageRoot, 'package.json'), {
    name: DSH_RUNTIME_PACKAGE,
    version,
    dependencies: {},
  })
  await mkdir(join(packageRoot, 'lib'), { recursive: true })
  await writeFile(join(packageRoot, 'lib/bin.js'), '#!/usr/bin/env node\n')
}

async function writeOverlayRoot(root: string, version = expectations.fuiVersion): Promise<void> {
  for (const packageName of DSH_DESKTOP_OVERLAY_PACKAGES) {
    const packageRoot = nodeModulesPackageRoot(root, packageName)
    await writeJson(join(packageRoot, 'package.json'), { name: packageName, version })
    const entry = join(packageRoot, overlayEntries[packageName])
    await mkdir(dirname(entry), { recursive: true })
    await writeFile(entry, packageName === '@deepseek-ai/dsh-web-frontend' ? '<!doctype html>\n' : '// fixture\n')
  }
}

function manifest(version: string): Response {
  return new Response(JSON.stringify({ version }), { status: 200, headers: { 'content-type': 'application/json' } })
}

async function harness(overrides: Partial<Config> = {}) {
  const runtimeRoot = await tempRoot()
  const pnpmEntry = join(runtimeRoot, 'pnpm.cjs')
  const overlayRoot = join(runtimeRoot, 'app-overlay')
  await writeFile(pnpmEntry, '// fake pnpm\n')
  await writeOverlayRoot(overlayRoot)
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(FakeSubprocessRuntime)
  const fiber = ctx.plugin(RuntimeUpdaterGateway, {
    currentVersion: '1.0.0',
    currentSource: 'bundled',
    fuiVersion: expectations.fuiVersion,
    compatibleDshRange: expectations.compatibleDshRange,
    overlayRoot,
    runtimeRoot,
    pnpmEntry,
    registryUrl: 'https://registry.npmjs.org',
    distTag: 'latest',
    checkTimeoutMs: 1_000,
    installTimeoutMs: 1_000,
    maxOutputBytes: 256,
    graceMs: 25,
    ...overrides,
  })
  await fiber.await()
  const updater = ctx.get('runtimeUpdater') as RuntimeUpdaterGateway
  const subprocess = ctx.subprocess as FakeSubprocessRuntime
  return { ctx, fiber, runtimeRoot, overlayRoot, updater, subprocess }
}

describe('RuntimeUpdaterGateway', () => {
  it('publishes description and cancellable update Remotes', async () => {
    const { updater } = await harness({ currentSource: 'managed', distTag: 'next' })
    expect(updater.typertRemote).toMatchObject({ serviceKey: 'runtimeUpdater', namespace: 'runtimeUpdater' })
    expect(remoteMethods(updater)).toEqual([
      { method: 'describe', invocation: { kind: 'direct' } },
      { method: 'check', invocation: { kind: 'direct' } },
      { method: 'update', invocation: { kind: 'direct' } },
    ])
    await expect(updater.describe({}, new AbortController().signal)).resolves.toEqual({
      packageName: DSH_RUNTIME_PACKAGE,
      currentVersion: '1.0.0',
      fuiVersion: expectations.fuiVersion,
      compatibleDshRange: expectations.compatibleDshRange,
      source: 'managed',
      distTag: 'next',
    })
  })

  it('checks the configured tag without installing', async () => {
    const { updater, subprocess } = await harness()
    updater.internals.fetch = vi.fn().mockResolvedValueOnce(manifest('1.1.0'))
    await expect(updater.check({}, new AbortController().signal)).resolves.toEqual({
      ok: true,
      value: { currentVersion: '1.0.0', latestVersion: '1.1.0', updateAvailable: true, compatible: true },
    })
    updater.internals.fetch = vi.fn().mockResolvedValueOnce(manifest('1.0.0'))
    await expect(updater.check({}, new AbortController().signal)).resolves.toEqual({
      ok: true,
      value: { currentVersion: '1.0.0', latestVersion: '1.0.0', updateAvailable: false, compatible: true },
    })
    updater.internals.fetch = vi.fn().mockResolvedValueOnce(manifest('2.0.0'))
    await expect(updater.check({}, new AbortController().signal)).resolves.toEqual({
      ok: true,
      value: { currentVersion: '1.0.0', latestVersion: '2.0.0', updateAvailable: true, compatible: false },
    })
    updater.internals.fetch = vi.fn().mockResolvedValueOnce(new Response('no', { status: 503 }))
    await expect(updater.check({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'check-failed' },
    })
    expect(subprocess.specs).toHaveLength(0)
  })

  it('reports up-to-date and rejects an official release outside the desktop compatibility range', async () => {
    const { updater, subprocess } = await harness()
    updater.internals.fetch = vi.fn().mockResolvedValueOnce(manifest('1.0.0'))
    await expect(updater.update({}, new AbortController().signal)).resolves.toEqual({
      ok: true,
      value: {
        status: 'up-to-date', currentVersion: '1.0.0', latestVersion: '1.0.0', restartRequired: false,
      },
    })
    updater.internals.fetch = vi.fn().mockResolvedValueOnce(manifest('2.0.0'))
    await expect(updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false,
      error: { code: 'incompatible', latestVersion: '2.0.0' },
    })
    expect(subprocess.specs).toHaveLength(0)
  })

  it('installs, validates, smokes, and commits one exact compatible release', async () => {
    const { updater, subprocess, runtimeRoot } = await harness()
    updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    subprocess.runs.push({
      stdout: 'installed\n',
      stderr: 'warning\n',
      lossy: true,
      beforeDone: async (spec) => {
        await expect(readFile(join(spec.cwd, 'pnpm-workspace.yaml'), 'utf8')).resolves.toContain(
          "  '@google/genai': false",
        )
        await writeInstalledTree(spec.cwd, '1.1.0')
      },
    }, { stdout: '1.1.0\n' })

    await expect(updater.update({}, new AbortController().signal)).resolves.toEqual({
      ok: true,
      value: {
        status: 'installed', currentVersion: '1.0.0', latestVersion: '1.1.0', restartRequired: true,
      },
    })
    expect(subprocess.specs[0]).toMatchObject({
      argv: [
        process.execPath,
        expect.stringContaining('pnpm.cjs'),
        '--config.verify-deps-before-run=false',
        '--config.manage-package-manager-versions=false',
        '--config.node-linker=hoisted',
        '--registry=https://registry.npmjs.org',
        'install',
        '--prod',
        '--reporter=append-only',
      ],
      stdio: { stdin: 'ignore', stdout: { maxBytes: 256 }, stderr: { maxBytes: 256 } },
      graceMs: 25,
      env: { ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE },
    })
    expect(subprocess.specs[0]?.cwd).toContain(join(runtimeRoot, '.install-'))
    expect(subprocess.specs[1]?.argv).toEqual([
      process.execPath,
      '--expose-internals',
      join(runtimeRoot, 'versions/1.1.0/node_modules/@deepseek-ai/dsh/lib/bin.js'),
      '--version',
    ])
    const managedRoot = join(runtimeRoot, 'versions/1.1.0/node_modules')
    const dshManifest = JSON.parse(await readFile(
      join(nodeModulesPackageRoot(managedRoot, DSH_RUNTIME_PACKAGE), 'package.json'),
      'utf8',
    )) as { dependencies: Record<string, string> }
    expect(dshManifest.dependencies[DSH_FUI_BUNDLE_PACKAGE]).toBe(expectations.fuiVersion)
    const fuiManifest = JSON.parse(await readFile(
      join(nodeModulesPackageRoot(managedRoot, DSH_FUI_BUNDLE_PACKAGE), 'package.json'),
      'utf8',
    )) as { version: string }
    expect(fuiManifest.version).toBe(expectations.fuiVersion)
    await expect(readManagedRuntime(runtimeRoot, expectations)).resolves.toMatchObject({ version: '1.1.0' })
  })

  it('returns stable registry, package-manager, and validation failures', async () => {
    const registry = await harness()
    registry.updater.internals.fetch = vi.fn().mockResolvedValue(new Response('no', { status: 503 }))
    await expect(registry.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'check-failed', message: 'npm registry returned HTTP 503.' },
    })

    const malformed = await harness()
    malformed.updater.internals.fetch = vi.fn().mockResolvedValue(new Response('{"version":"latest"}', { status: 200 }))
    await expect(malformed.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'check-failed' },
    })

    const install = await harness()
    install.updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    install.subprocess.runs.push({
      outcome: { exitCode: 7, signal: null }, stdout: 'out', stderr: 'bad', lossy: true,
    })
    await expect(install.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false,
      error: {
        code: 'install-failed', latestVersion: '1.1.0', exitCode: 7,
        stdout: '[earlier output truncated]\nout', stderr: '[earlier output truncated]\nbad',
      },
    })

    const validation = await harness()
    validation.updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    validation.subprocess.runs.push({ beforeDone: spec => writeInstalledTree(spec.cwd, '1.0.9') })
    await expect(validation.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'validation-failed', latestVersion: '1.1.0' },
    })

    const smoke = await harness()
    smoke.updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    smoke.subprocess.runs.push({
      beforeDone: spec => writeInstalledTree(spec.cwd, '1.1.0'),
    }, { stdout: '1.0.9\n' })
    await expect(smoke.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'validation-failed', latestVersion: '1.1.0' },
    })
    await expect(readManagedRuntime(smoke.runtimeRoot, expectations)).resolves.toBeUndefined()
  })

  it('reports check and install deadlines with stable failure codes', async () => {
    const check = await harness({ checkTimeoutMs: 17 })
    const checkDeadline = new AbortController()
    check.updater.internals.timeoutSignal = (milliseconds) => {
      expect(milliseconds).toBe(17)
      queueMicrotask(() => { checkDeadline.abort(new DOMException('deadline', 'TimeoutError')) })
      return checkDeadline.signal
    }
    check.updater.internals.fetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const signal = init?.signal
      if (!(signal instanceof AbortSignal)) throw new Error('test fetch received no signal')
      await Promise.resolve()
      signal.throwIfAborted()
      return manifest('1.0.0')
    })
    await expect(check.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'timed-out' },
    })

    const install = await harness({ installTimeoutMs: 23 })
    const installDeadlines: AbortController[] = []
    install.updater.internals.timeoutSignal = (milliseconds) => {
      const deadline = new AbortController()
      installDeadlines.push(deadline)
      if (milliseconds === 23) queueMicrotask(() => { deadline.abort(new DOMException('deadline', 'TimeoutError')) })
      return deadline.signal
    }
    install.updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    install.subprocess.runs.push({ beforeDone: () => new Promise(() => {}), settleOnAbort: true })
    await expect(install.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'timed-out', latestVersion: '1.1.0' },
    })
    expect(installDeadlines).toHaveLength(2)
  })

  it('serializes updates and joins request cancellation with subprocess lifetime', async () => {
    const busy = await harness()
    const response = Promise.withResolvers<Response>()
    busy.updater.internals.fetch = vi.fn(() => response.promise)
    const first = busy.updater.update({}, new AbortController().signal)
    await expect(busy.updater.update({}, new AbortController().signal)).resolves.toMatchObject({
      ok: false, error: { code: 'busy' },
    })
    response.resolve(manifest('1.0.0'))
    await expect(first).resolves.toMatchObject({ ok: true })

    const cancelled = await harness()
    cancelled.updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    cancelled.subprocess.runs.push({ beforeDone: () => new Promise(() => {}), settleOnAbort: true })
    const controller = new AbortController()
    const operation = cancelled.updater.update({}, controller.signal)
    await vi.waitFor(() => { expect(cancelled.subprocess.specs).toHaveLength(1) })
    controller.abort(new Error('left settings'))
    await expect(operation).rejects.toThrow('left settings')

    const unloading = await harness()
    unloading.updater.internals.fetch = vi.fn().mockResolvedValue(manifest('1.1.0'))
    unloading.subprocess.runs.push({ beforeDone: () => new Promise(() => {}), settleOnAbort: true })
    const active = unloading.updater.update({}, new AbortController().signal)
    await vi.waitFor(() => { expect(unloading.subprocess.specs).toHaveLength(1) })
    await unloading.fiber.dispose()
    await expect(active).rejects.toThrow('service is unloading')
  })

  it('fails load outside desktop and for unsafe deployment configuration', async () => {
    const runtimeRoot = await tempRoot()
    const pnpmEntry = join(runtimeRoot, 'pnpm.cjs')
    const overlayRoot = join(runtimeRoot, 'app-overlay')
    await writeFile(pnpmEntry, '// fake\n')
    await writeOverlayRoot(overlayRoot)
    const base: Config = {
      currentVersion: '1.0.0', currentSource: 'bundled',
      fuiVersion: expectations.fuiVersion, compatibleDshRange: expectations.compatibleDshRange, overlayRoot,
      runtimeRoot, pnpmEntry,
      registryUrl: 'https://registry.npmjs.org', distTag: 'latest',
      checkTimeoutMs: 1, installTimeoutMs: 1, maxOutputBytes: 1, graceMs: 1,
    }
    const make = (config: Config): RuntimeUpdaterGateway => {
      const ctx = new Context()
      contexts.push(ctx)
      new FakeSubprocessRuntime(ctx)
      return new RuntimeUpdaterGateway(ctx, config)
    }

    delete process.env.DSH_DESKTOP
    expect(() => make(base)).toThrow('only load inside the desktop Host')
    process.env.DSH_DESKTOP = '1'
    expect(() => make({ ...base, currentVersion: 'latest' })).toThrow('valid exact semver')
    expect(() => make({ ...base, compatibleDshRange: 'future' })).toThrow('valid semver')
    expect(() => make({ ...base, overlayRoot: join(runtimeRoot, 'missing-overlay') })).toThrow('overlayRoot')
    expect(() => make({ ...base, runtimeRoot: 'relative' })).toThrow('runtimeRoot must be absolute')
    expect(() => make({ ...base, pnpmEntry: join(runtimeRoot, 'missing.cjs') })).toThrow('existing absolute file')
    expect(() => make({ ...base, registryUrl: 'http://registry.example.com' })).toThrow('HTTPS or loopback HTTP')
    expect(() => make({ ...base, distTag: '../latest' })).toThrow('one non-empty npm tag')
  })
})
