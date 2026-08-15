/** Desktop-only adapter from the plugin-install Remote to `dsh plugin`. */

import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SubprocessHandle, SubprocessOutcome, SubprocessOutputRead } from '@deepseek-ai/dsh-subprocess'
import { TypertRemoteService, Remote } from '@deepseek-ai/dsh-typert-protocol'
// Typert-generated ./typert and ./remote artifacts import Zod at runtime.
import type {} from 'zod'
import type {
  PluginInstallFailure,
  PluginInstallRequest,
  PluginInstallResult,
} from './types.ts'

export type * from './types.ts'

/** Validated process and resource policy for one desktop installer. */
export interface Config {
  /** Absolute built `dsh` CLI entry owned by the desktop application. */
  cliEntry: string
  /** Writable profile that receives installed packages. */
  profile: string
  /** Whole installation deadline in milliseconds. */
  timeoutMs: number
  /** In-memory tail bound for each child output stream. */
  maxOutputBytes: number
  /** TERM-to-KILL escalation grace for the package-manager process tree. */
  graceMs: number
  /** Maximum accepted package-spec length. */
  maxSpecChars: number
}

/** Turn an arbitrary abort reason into an Error suitable for a rejected Remote call. */
function abortError(signal: AbortSignal): Error {
  return signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason))
}

/** Preserve the bounded output tail and mark a lossy prefix explicitly. */
function outputText(read: SubprocessOutputRead): string {
  return `${read.lossy ? '[earlier output truncated]\n' : ''}${read.text}`
}

/** Build one typed failure with child diagnostics only when they exist. */
function failed(
  code: PluginInstallFailure['code'],
  message: string,
  detail?: Pick<PluginInstallFailure, 'exitCode' | 'stdout' | 'stderr'>,
): PluginInstallResult {
  return { ok: false, error: { code, message, ...detail } }
}

/** Convert process setup and completion exceptions into one stable failure. */
function processFailure(error: unknown): PluginInstallResult {
  return failed('install-failed', error instanceof Error ? error.message : 'Plugin process failed to start.')
}

/** Normalize the single argv token accepted by the desktop install form. */
function normalizeSpec(raw: string, maxSpecChars: number): PluginInstallResult | string {
  const spec = raw.trim()
  if (spec.length === 0) return failed('invalid-spec', 'Plugin package spec must not be empty.')
  if (spec.length > maxSpecChars) {
    return failed('invalid-spec', `Plugin package spec exceeds ${String(maxSpecChars)} characters.`)
  }
  if (spec.startsWith('-') || /[\u0000-\u0020\u007f]/u.test(spec)) {
    return failed('invalid-spec', 'Plugin package spec must be one package or Git argument without whitespace or options.')
  }
  return spec
}

/** Remote adapter that owns one serialized desktop profile mutation at a time. */
export class PluginInstallerGateway extends TypertRemoteService {
  static inject = ['subprocess']

  static Config: z<Config> = z.object({
    cliEntry: z.string(),
    profile: z.string().default('fui'),
    timeoutMs: z.natural().min(1).default(300_000),
    maxOutputBytes: z.natural().min(1).default(64_000),
    graceMs: z.natural().min(1).default(5_000),
    maxSpecChars: z.natural().min(1).default(2_048),
  })

  private readonly lifecycle = new AbortController()
  private active: Promise<PluginInstallResult> | undefined

  /**
   * @param ctx - Desktop Host context carrying the managed subprocess service.
   * @param config - CLI location, profile, and bounded execution policy.
   */
  constructor(ctx: Context, private readonly config: Config) {
    super(ctx, 'pluginInstaller')
    if (process.env.DSH_DESKTOP !== '1') {
      throw new Error('plugin-installer: this capability may only load inside the desktop Host')
    }
    if (!isAbsolute(config.cliEntry) || !existsSync(config.cliEntry)) {
      throw new Error('plugin-installer: cliEntry must name an existing absolute dsh CLI entry')
    }
    ctx.effect(() => async () => {
      this.lifecycle.abort(new Error('plugin-installer: service is unloading'))
      await this.active?.catch(() => {})
    }, 'plugin-installer: drain active installation')
  }

  /**
   * Install one package into the configured profile. Requests are serialized
   * because pnpm and the profile manifest share one writable state.
   * @param request - One package name, versioned package, tarball URL, or Git spec.
   * @param signal - Remote request lifetime.
   * @returns A committed install, or a stable business failure with bounded diagnostics.
   */
  @Remote('add')
  install(request: PluginInstallRequest, signal: AbortSignal): Promise<PluginInstallResult> {
    const normalized = normalizeSpec(request.spec, this.config.maxSpecChars)
    if (typeof normalized !== 'string') return Promise.resolve(normalized)
    if (this.active !== undefined) {
      return Promise.resolve(failed('busy', 'Another plugin installation is already running.'))
    }
    const operation = this.run(normalized, signal)
    this.active = operation
    return operation.finally(() => {
      this.active = undefined
    })
  }

  private async run(spec: string, requestSignal: AbortSignal): Promise<PluginInstallResult> {
    requestSignal.throwIfAborted()
    const timeoutSignal = AbortSignal.timeout(this.config.timeoutMs)
    const signal = AbortSignal.any([requestSignal, this.lifecycle.signal, timeoutSignal])
    let handle: SubprocessHandle
    try {
      handle = this.ctx.subprocess.spawn({
        argv: [
          process.execPath,
          '--expose-internals',
          this.config.cliEntry,
          'plugin',
          '--profile',
          this.config.profile,
          'add',
          '--',
          spec,
        ],
        cwd: process.cwd(),
        stdio: {
          stdin: 'ignore',
          stdout: { maxBytes: this.config.maxOutputBytes },
          stderr: { maxBytes: this.config.maxOutputBytes },
        },
        graceMs: this.config.graceMs,
        signal,
        env: {
          DSH_PNPM_ENTRY: process.env.DSH_PNPM_ENTRY,
        },
      })
    } catch (error) {
      return processFailure(error)
    }

    let outcome: SubprocessOutcome
    try {
      outcome = await handle.done
    } catch (error) {
      return processFailure(error)
    }
    if (requestSignal.aborted) throw abortError(requestSignal)
    if (this.lifecycle.signal.aborted) throw abortError(this.lifecycle.signal)

    const { stdout: stdoutCollector, stderr: stderrCollector } = handle.collected
    assert(stdoutCollector !== undefined, 'plugin-installer: collected stdout reader is missing')
    assert(stderrCollector !== undefined, 'plugin-installer: collected stderr reader is missing')
    const stdout = outputText(stdoutCollector.readFrom(0))
    const stderr = outputText(stderrCollector.readFrom(0))
    const detail = { exitCode: outcome.exitCode, stdout, stderr }
    if (timeoutSignal.aborted) {
      return failed('timed-out', `Plugin installation exceeded ${String(this.config.timeoutMs)}ms.`, detail)
    }
    if (outcome.exitCode !== 0) {
      return failed('install-failed', 'The package manager did not install this plugin.', detail)
    }
    return {
      ok: true,
      value: { spec, restartRequired: true, stdout, stderr },
    }
  }
}

export default PluginInstallerGateway
