/** Desktop-only Host provider for one-click managed DSH runtime updates. */

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, sep } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SubprocessHandle, SubprocessOutcome, SubprocessOutputRead } from '@deepseek-ai/dsh-subprocess'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { gt, satisfies, valid, validRange } from 'semver'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import {
  commitManagedRuntime,
  DSH_DESKTOP_OVERLAY_PACKAGES,
  DSH_FUI_BUNDLE_PACKAGE,
  DSH_RUNTIME_PACKAGE,
  managedRuntimePaths,
  nodeModulesPackageRoot,
  validateManagedRuntime,
  type ManagedRuntimeExpectations,
} from './managed-runtime.ts'
import type {
  DesktopRuntimeSource,
  RuntimeUpdateDescribeRequest,
  RuntimeUpdateDescription,
  RuntimeUpdateFailure,
  RuntimeUpdateRequest,
  RuntimeUpdateResult,
} from './types.ts'

export type * from './types.ts'

/** Validated registry, process, and filesystem policy for one desktop updater. */
export interface Config {
  /** Version serving the current desktop Host. */
  currentVersion: string
  /** Whether the current Host came from application resources or managed storage. */
  currentSource: DesktopRuntimeSource
  /** Exact application-owned FUI overlay version. */
  fuiVersion: string
  /** Official DSH versions this desktop FUI release supports. */
  compatibleDshRange: string
  /** Absolute immutable node_modules root containing the application-owned FUI overlay. */
  overlayRoot: string
  /** Absolute writable root holding managed runtime versions and the active pointer. */
  runtimeRoot: string
  /** Absolute packaged pnpm JavaScript entry supplied by the Electron shell. */
  pnpmEntry: string
  /** npm registry base URL. */
  registryUrl: string
  /** npm dist-tag selected by this desktop release channel. */
  distTag: string
  /** Registry request deadline in milliseconds. */
  checkTimeoutMs: number
  /** Package installation deadline in milliseconds. */
  installTimeoutMs: number
  /** In-memory tail bound for each child output stream. */
  maxOutputBytes: number
  /** TERM-to-KILL escalation grace for managed child process trees. */
  graceMs: number
}

interface RegistryManifest {
  readonly version: string
}

interface ChildResult {
  readonly outcome: SubprocessOutcome
  readonly stdout: string
  readonly stderr: string
}

/** Test substitutions for registry transport; production keeps the global implementation. */
export interface RuntimeUpdaterInternals {
  fetch?: typeof globalThis.fetch
  timeoutSignal?: (milliseconds: number) => AbortSignal
}

/** Turn an arbitrary abort reason into an Error suitable for a rejected Remote call. */
function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason))
}

/** Preserve a bounded output tail and mark a lossy prefix explicitly. */
function outputText(read: SubprocessOutputRead): string {
  return `${read.lossy ? '[earlier output truncated]\n' : ''}${read.text}`
}

/** Build one typed failure with process diagnostics only when they exist. */
function failed(
  code: RuntimeUpdateFailure['code'],
  message: string,
  detail?: Omit<RuntimeUpdateFailure, 'code' | 'message'>,
): RuntimeUpdateResult {
  return { ok: false, error: { code, message, ...detail } }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Validate the small registry response before it controls a filesystem path or argv value. */
function registryManifest(value: unknown): RegistryManifest {
  if (!isObject(value) || typeof value.version !== 'string' || valid(value.version) !== value.version) {
    throw new Error('registry metadata has no valid exact version')
  }
  return { version: value.version }
}

/** Validate immutable overlay package identities before exposing the update operation. */
function validateOverlaySource(config: Pick<Config, 'fuiVersion' | 'overlayRoot'>): void {
  if (!isAbsolute(config.overlayRoot) || !existsSync(config.overlayRoot)) {
    throw new Error('runtime-updater: overlayRoot must name an existing absolute directory')
  }
  for (const packageName of DSH_DESKTOP_OVERLAY_PACKAGES) {
    const manifestPath = join(nodeModulesPackageRoot(config.overlayRoot, packageName), 'package.json')
    const value = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
    if (!isObject(value) || value.name !== packageName || value.version !== config.fuiVersion) {
      throw new Error(`runtime-updater: overlay source does not contain ${packageName}@${config.fuiVersion}`)
    }
  }
}

/** Registry URL for one exact package dist-tag document. */
function registryManifestUrl(registryUrl: string, distTag: string): URL {
  const base = registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`
  return new URL(`${encodeURIComponent(DSH_RUNTIME_PACKAGE)}/${encodeURIComponent(distTag)}`, base)
}

/** Ensure the configured registry is encrypted, with loopback HTTP permitted for tests and private mirrors. */
function validateRegistryUrl(raw: string): void {
  const url = new URL(raw)
  const loopback = url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '::1'
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('runtime-updater: registryUrl must use HTTPS or loopback HTTP')
  }
}

/** Desktop-only serialized provider for checking and installing a compatible DSH closure. */
export class RuntimeUpdaterGateway extends TypertRemoteService {
  static inject = ['subprocess']

  static Config: z<Config> = z.object({
    currentVersion: z.string(),
    currentSource: z.union(['bundled', 'managed']).default('bundled'),
    fuiVersion: z.string(),
    compatibleDshRange: z.string(),
    overlayRoot: z.string(),
    runtimeRoot: z.string(),
    pnpmEntry: z.string(),
    registryUrl: z.string().default('https://registry.npmjs.org'),
    distTag: z.string().default('latest'),
    checkTimeoutMs: z.natural().min(1).default(15_000),
    installTimeoutMs: z.natural().min(1).default(300_000),
    maxOutputBytes: z.natural().min(1).default(64_000),
    graceMs: z.natural().min(1).default(5_000),
  })

  /** Test-only registry transport substitution. */
  internals: RuntimeUpdaterInternals = {}

  private readonly lifecycle = new AbortController()
  private active: Promise<RuntimeUpdateResult> | undefined

  private get runtimeExpectations(): ManagedRuntimeExpectations {
    return {
      fuiVersion: this.config.fuiVersion,
      compatibleDshRange: this.config.compatibleDshRange,
    }
  }

  /**
   * @param ctx - Desktop Host context carrying the managed subprocess service.
   * @param config - Current version, registry, destination, and bounded execution policy.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'runtimeUpdater')
    if (process.env.DSH_DESKTOP !== '1') {
      throw new Error('runtime-updater: this capability may only load inside the desktop Host')
    }
    if (valid(config.currentVersion) !== config.currentVersion) {
      throw new Error('runtime-updater: currentVersion must be valid exact semver')
    }
    if (valid(config.fuiVersion) !== config.fuiVersion) {
      throw new Error('runtime-updater: fuiVersion must be valid exact semver')
    }
    if (validRange(config.compatibleDshRange) === null) {
      throw new Error('runtime-updater: compatibleDshRange must be valid semver')
    }
    validateOverlaySource(config)
    if (!isAbsolute(config.runtimeRoot)) {
      throw new Error('runtime-updater: runtimeRoot must be absolute')
    }
    if (!isAbsolute(config.pnpmEntry) || !existsSync(config.pnpmEntry)) {
      throw new Error('runtime-updater: pnpmEntry must name an existing absolute file')
    }
    if (config.distTag.length === 0 || /[\u0000-\u0020\u007f/\\]/u.test(config.distTag)) {
      throw new Error('runtime-updater: distTag must be one non-empty npm tag')
    }
    validateRegistryUrl(config.registryUrl)
    ctx.effect(() => async () => {
      this.lifecycle.abort(new Error('runtime-updater: service is unloading'))
      await this.active?.catch(() => {})
    }, 'runtime-updater: drain active update')
  }

  /**
   * Read the version facts displayed before the user starts a network request.
   * @param _request - Empty request; renderer input cannot choose package, registry, or destination.
   * @param signal - Remote request lifetime.
   * @returns current package identity, version, source, and release tag.
   */
  @Remote('describe')
  describe(_request: RuntimeUpdateDescribeRequest, signal: AbortSignal): Promise<RuntimeUpdateDescription> {
    signal.throwIfAborted()
    return Promise.resolve({
      packageName: DSH_RUNTIME_PACKAGE,
      currentVersion: this.config.currentVersion,
      fuiVersion: this.config.fuiVersion,
      compatibleDshRange: this.config.compatibleDshRange,
      source: this.config.currentSource,
      distTag: this.config.distTag,
    })
  }

  /**
   * Check the configured npm tag and install a compatible newer runtime.
   * @param _request - Empty request; all authority stays in Host configuration.
   * @param signal - Remote request lifetime; cancellation terminates package-manager work.
   * @returns an up-to-date or committed-install result, or a stable business failure.
   */
  @Remote('update')
  update(_request: RuntimeUpdateRequest, signal: AbortSignal): Promise<RuntimeUpdateResult> {
    if (this.active !== undefined) {
      return Promise.resolve(failed('busy', 'Another desktop runtime update is already running.'))
    }
    const operation = this.run(signal)
    this.active = operation
    return operation.finally(() => {
      this.active = undefined
    })
  }

  private async run(requestSignal: AbortSignal): Promise<RuntimeUpdateResult> {
    requestSignal.throwIfAborted()
    const checked = await this.check(requestSignal)
    if (!checked.ok) return checked.result
    const latest = checked.manifest
    if (!gt(latest.version, this.config.currentVersion)) {
      return {
        ok: true,
        value: {
          status: 'up-to-date',
          currentVersion: this.config.currentVersion,
          latestVersion: latest.version,
          restartRequired: false,
        },
      }
    }
    if (!satisfies(latest.version, this.config.compatibleDshRange, { includePrerelease: true })) {
      return failed(
        'incompatible',
        `Official ${DSH_RUNTIME_PACKAGE}@${latest.version} is outside desktop compatibility ${this.config.compatibleDshRange}.`,
        { latestVersion: latest.version },
      )
    }
    return this.install(latest.version, requestSignal)
  }

  private async check(requestSignal: AbortSignal): Promise<
    | { readonly ok: true; readonly manifest: RegistryManifest }
    | { readonly ok: false; readonly result: RuntimeUpdateResult }
  > {
    const timeoutSignal = (this.internals.timeoutSignal ?? (milliseconds => AbortSignal.timeout(milliseconds)))(
      this.config.checkTimeoutMs,
    )
    const signal = AbortSignal.any([requestSignal, this.lifecycle.signal, timeoutSignal])
    try {
      const response = await (this.internals.fetch ?? globalThis.fetch)(
        registryManifestUrl(this.config.registryUrl, this.config.distTag),
        { headers: { accept: 'application/json' }, signal },
      )
      if (!response.ok) {
        return { ok: false, result: failed('check-failed', `npm registry returned HTTP ${String(response.status)}.`) }
      }
      return { ok: true, manifest: registryManifest(await response.json()) }
    } catch (error) {
      if (requestSignal.aborted) throw abortError(requestSignal)
      if (this.lifecycle.signal.aborted) throw abortError(this.lifecycle.signal)
      if (timeoutSignal.aborted) {
        return { ok: false, result: failed('timed-out', `Runtime update check exceeded ${String(this.config.checkTimeoutMs)}ms.`) }
      }
      return {
        ok: false,
        result: failed('check-failed', error instanceof Error ? error.message : 'npm registry metadata was invalid.'),
      }
    }
  }

  private async install(version: string, requestSignal: AbortSignal): Promise<RuntimeUpdateResult> {
    const timeoutSignal = (this.internals.timeoutSignal ?? (milliseconds => AbortSignal.timeout(milliseconds)))(
      this.config.installTimeoutMs,
    )
    const signal = AbortSignal.any([requestSignal, this.lifecycle.signal, timeoutSignal])
    const paths = managedRuntimePaths(this.config.runtimeRoot, version)
    await mkdir(join(this.config.runtimeRoot, 'versions'), { recursive: true, mode: 0o700 })

    try {
      await validateManagedRuntime(this.config.runtimeRoot, version, this.runtimeExpectations)
    } catch {
      const prepared = await this.prepare(version, signal)
      if (!prepared.ok) return prepared.result
    }

    let smoke: ChildResult
    try {
      smoke = await this.runChild([
        process.execPath,
        '--expose-internals',
        paths.cliEntry,
        '--version',
      ], paths.root, signal)
    } catch (error) {
      if (requestSignal.aborted) throw abortError(requestSignal)
      if (this.lifecycle.signal.aborted) throw abortError(this.lifecycle.signal)
      await this.quarantineVersion(version)
      return failed(
        timeoutSignal.aborted ? 'timed-out' : 'validation-failed',
        error instanceof Error ? error.message : 'Installed dsh validation process failed.',
        { latestVersion: version },
      )
    }
    if (requestSignal.aborted) throw abortError(requestSignal)
    if (this.lifecycle.signal.aborted) throw abortError(this.lifecycle.signal)
    if (timeoutSignal.aborted) {
      return failed('timed-out', `Runtime installation exceeded ${String(this.config.installTimeoutMs)}ms.`, {
        latestVersion: version,
        exitCode: smoke.outcome.exitCode,
        stdout: smoke.stdout,
        stderr: smoke.stderr,
      })
    }
    if (smoke.outcome.exitCode !== 0 || smoke.stdout.trim() !== version) {
      await this.quarantineVersion(version)
      return failed('validation-failed', `Installed dsh did not report version ${version}.`, {
        latestVersion: version,
        exitCode: smoke.outcome.exitCode,
        stdout: smoke.stdout,
        stderr: smoke.stderr,
      })
    }
    try {
      await commitManagedRuntime(this.config.runtimeRoot, version, this.runtimeExpectations)
    } catch (error) {
      return failed(
        'install-failed',
        error instanceof Error ? error.message : 'The validated desktop runtime could not be selected.',
        { latestVersion: version },
      )
    }
    return {
      ok: true,
      value: {
        status: 'installed',
        currentVersion: this.config.currentVersion,
        latestVersion: version,
        restartRequired: true,
      },
    }
  }

  private async prepare(
    version: string,
    signal: AbortSignal,
  ): Promise<
    | { readonly ok: true }
    | { readonly ok: false; readonly result: RuntimeUpdateResult }
  > {
    const paths = managedRuntimePaths(this.config.runtimeRoot, version)
    const initialAbort = this.abortedInstallIfNeeded(version, signal)
    if (initialAbort !== undefined) return { ok: false, result: initialAbort }
    if (existsSync(paths.root)) await this.quarantineVersion(version)
    const staging = await mkdtemp(join(this.config.runtimeRoot, '.install-'))
    try {
      await writeFile(join(staging, 'package.json'), `${JSON.stringify({
        name: 'dsh-desktop-managed-runtime',
        private: true,
        version: '0.0.0',
        dependencies: { [DSH_RUNTIME_PACKAGE]: version },
      }, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
      await writeFile(join(staging, 'pnpm-workspace.yaml'), [
        'allowBuilds:',
        '  esbuild: true',
        '  koffi: true',
        '  node-pty: true',
        '  \'@google/genai\': false',
        '  node-addon-require-builtin: false',
        '  protobufjs: false',
        '  \'@deepseek-ai/dsh-subprocess-local\': true',
        '',
      ].join('\n'), { flag: 'wx', mode: 0o600 })
      const preSpawnAbort = this.abortedInstallIfNeeded(version, signal)
      if (preSpawnAbort !== undefined) return { ok: false, result: preSpawnAbort }
      const child = await this.runChild([
        process.execPath,
        this.config.pnpmEntry,
        '--config.verify-deps-before-run=false',
        '--config.manage-package-manager-versions=false',
        '--config.node-linker=hoisted',
        `--registry=${this.config.registryUrl}`,
        'install',
        '--prod',
        '--reporter=append-only',
      ], staging, signal)
      const childAbort = this.abortedInstallIfNeeded(version, signal, child)
      if (childAbort !== undefined) return { ok: false, result: childAbort }
      if (child.outcome.exitCode !== 0) {
        return {
          ok: false,
          result: failed('install-failed', 'The package manager did not install the desktop runtime.', {
            latestVersion: version,
            exitCode: child.outcome.exitCode,
            stdout: child.stdout,
            stderr: child.stderr,
          }),
        }
      }
      await this.installOverlay(staging)
      await rename(staging, paths.root)
      try {
        await validateManagedRuntime(this.config.runtimeRoot, version, this.runtimeExpectations)
      } catch (error) {
        await this.quarantineVersion(version)
        return {
          ok: false,
          result: failed('validation-failed', error instanceof Error ? error.message : 'Installed runtime validation failed.', {
            latestVersion: version,
            exitCode: child.outcome.exitCode,
            stdout: child.stdout,
            stderr: child.stderr,
          }),
        }
      }
      return { ok: true }
    } catch (error) {
      const operationAbort = this.abortedInstallIfNeeded(version, signal)
      if (operationAbort !== undefined) return { ok: false, result: operationAbort }
      return {
        ok: false,
        result: failed('install-failed', error instanceof Error ? error.message : 'Runtime installation failed.', {
          latestVersion: version,
        }),
      }
    } finally {
      await rm(staging, { recursive: true, force: true })
    }
  }

  /** Copy this application release's FUI packages over the isolated official DSH installation. */
  private async installOverlay(staging: string): Promise<void> {
    const targetNodeModules = join(staging, 'node_modules')
    for (const packageName of DSH_DESKTOP_OVERLAY_PACKAGES) {
      const source = await realpath(nodeModulesPackageRoot(this.config.overlayRoot, packageName))
      const destination = nodeModulesPackageRoot(targetNodeModules, packageName)
      const nestedModules = join(source, 'node_modules')
      await rm(destination, { recursive: true, force: true })
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
      await cp(source, destination, {
        recursive: true,
        dereference: true,
        filter: path => path !== nestedModules && !path.startsWith(`${nestedModules}${sep}`),
      })
    }

    const cliManifestPath = join(nodeModulesPackageRoot(targetNodeModules, DSH_RUNTIME_PACKAGE), 'package.json')
    const raw = JSON.parse(await readFile(cliManifestPath, 'utf8')) as unknown
    if (!isObject(raw)) throw new Error(`official DSH manifest is not an object: ${cliManifestPath}`)
    const dependencies = isObject(raw.dependencies) ? raw.dependencies : {}
    await writeFile(cliManifestPath, `${JSON.stringify({
      ...raw,
      dependencies: { ...dependencies, [DSH_FUI_BUNDLE_PACKAGE]: this.config.fuiVersion },
    }, null, 2)}\n`, { mode: 0o600 })
  }

  private abortedInstallIfNeeded(
    version: string,
    signal: AbortSignal,
    child?: ChildResult,
  ): RuntimeUpdateResult | undefined {
    return signal.aborted ? this.abortedInstall(version, signal, child) : undefined
  }

  private abortedInstall(version: string, signal: AbortSignal, child?: ChildResult): RuntimeUpdateResult {
    if (this.lifecycle.signal.aborted) throw abortError(this.lifecycle.signal)
    if (signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError') {
      return failed('timed-out', `Runtime installation exceeded ${String(this.config.installTimeoutMs)}ms.`, {
        latestVersion: version,
        ...(child === undefined ? {} : {
          exitCode: child.outcome.exitCode,
          stdout: child.stdout,
          stderr: child.stderr,
        }),
      })
    }
    throw abortError(signal)
  }

  private async quarantineVersion(version: string): Promise<void> {
    const paths = managedRuntimePaths(this.config.runtimeRoot, version)
    if (!existsSync(paths.root)) return
    const quarantineRoot = join(this.config.runtimeRoot, 'quarantine')
    await mkdir(quarantineRoot, { recursive: true, mode: 0o700 })
    await rename(paths.root, join(quarantineRoot, `${version}-${Date.now().toString(36)}`))
  }

  private async runChild(argv: readonly string[], cwd: string, signal: AbortSignal): Promise<ChildResult> {
    let handle: SubprocessHandle
    try {
      handle = this.ctx.subprocess.spawn({
        argv,
        cwd,
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: this.config.maxOutputBytes },
          stderr: { maxBytes: this.config.maxOutputBytes },
        },
        graceMs: this.config.graceMs,
        signal,
        env: {
          ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE,
        },
      })
    } catch (error) {
      throw new Error(`runtime-updater: process failed to start: ${error instanceof Error ? error.message : String(error)}`)
    }
    const outcome = await handle.done
    const { stdout: stdoutCollector, stderr: stderrCollector } = handle.collected
    assert(stdoutCollector !== undefined, 'runtime-updater: collected stdout reader is missing')
    assert(stderrCollector !== undefined, 'runtime-updater: collected stderr reader is missing')
    return {
      outcome,
      stdout: outputText(stdoutCollector.readFrom(0)),
      stderr: outputText(stderrCollector.readFrom(0)),
    }
  }
}

export default RuntimeUpdaterGateway
