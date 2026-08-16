/**
 * `dsh plugin --profile <name> <args...>` — profile plugin management as a
 * thin pnpm forwarder: initialize the profile on first use, run
 * `pnpm <args...>` in the profile directory, then reconcile the
 * `dsh.profile.bundles` layer list against the installed state (a dependency
 * resolving to a package that declares `dsh.bundle` joins the layer stack; a
 * removed or bundle-less dependency leaves it). Reconciling by installed
 * state, not by dependency diff, means `update` activates a package that
 * gained its `dsh.bundle` declaration in a newer version. A failed attempt
 * whose output names build scripts pnpm ≥11 refused to run is retried after
 * merging those keys into the profile's `allowBuilds` — submitting the
 * install is already the user's trust decision, so the package manager's
 * per-package allowlist must not re-block it; only genuine failures
 * (resolution, compatibility, network) surface as errors.
 * @module @deepseek-ai/dsh/plugin
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { dump, load } from 'js-yaml'
import {
  DEFAULT_PROFILE_BUNDLES,
  initProfile,
  PROFILE_TEMPLATES,
  readProfileManifest,
  resolveBundleDir,
  resolveProfileDir,
  writeProfileManifest,
  type ProfileManifest,
} from '@deepseek-ai/dsh-app-boot'
import { INSTALL_ANCHOR } from './profile-boot.ts'

const NAME = 'dsh'

/**
 * Whether a resolved dependency exports a profile patch, i.e. is a bundle.
 * @param packageName - the dependency's package name.
 * @param profileDir - the profile directory (resolution anchor).
 * @returns true when the package manifest declares `dsh.bundle`.
 */
function exportsPatch(packageName: string, profileDir: string): boolean {
  let dir: string
  try {
    dir = resolveBundleDir(NAME, packageName, INSTALL_ANCHOR, profileDir)
  } catch {
    return false // pnpm reported success yet the package is unresolvable — treat as plain
  }
  const manifest = readProfileManifest(NAME, dir)
  return manifest.dsh?.bundle?.patch !== undefined
}

/**
 * Reconcile `dsh.profile.bundles` against the installed state: pnpm has
 * already written the real installed names (so a git/path/tarball/alias spec
 * on the command line reconciles by its true package name) and materialized
 * the packages. A dependency that resolves to a `dsh.bundle`-declaring
 * package joins the layer stack (appended in dependency order); a
 * dependency-listed name that no longer does — removed, or the installed
 * version dropped the declaration — leaves it. In-box bundles from the
 * profile template are not dependencies and are never touched. Warns once
 * per newly-added bundle-less dependency (a plain library is fine; the
 * warning is orientation).
 */
function reconcilePlugins(before: ProfileManifest, profileDir: string): void {
  const after = readProfileManifest(NAME, profileDir)
  const beforeDeps = new Set(Object.keys(before.dependencies ?? {}))
  const dependencies = Object.keys(after.dependencies ?? {})
  const plugins = after.dsh?.profile?.bundles ?? []
  let changed = false
  for (const packageName of dependencies) {
    const isBundle = exportsPatch(packageName, profileDir)
    if (isBundle && !plugins.includes(packageName)) {
      plugins.push(packageName)
      changed = true
    } else if (!isBundle && !beforeDeps.has(packageName)) {
      process.stderr.write(
        `${NAME}: warning: ${packageName} declares no dsh.bundle — installed as a plain dependency, not a profile layer `
        + '(a later update that gains one activates it automatically)\n',
      )
    }
  }
  const dependencySet = new Set(dependencies)
  for (const packageName of [...plugins]) {
    // Only dependency-managed entries are subject to removal; template
    // bundles (dsh-base and friends) are not dependencies.
    const wasDependency = beforeDeps.has(packageName) || dependencySet.has(packageName)
    const stillBundle = dependencySet.has(packageName) && exportsPatch(packageName, profileDir)
    if (wasDependency && !stillBundle) {
      plugins.splice(plugins.indexOf(packageName), 1)
      changed = true
    }
  }
  if (!changed) return
  after.dsh = { ...after.dsh, profile: { ...after.dsh?.profile, bundles: plugins } }
  writeProfileManifest(profileDir, after)
}

/**
 * Rewrite relative filesystem specs against the user's invoking directory.
 * pnpm runs with cwd = the profile directory, so a bare `.` or `../plugin`
 * (or their `file:`/`link:` forms) would silently resolve inside the profile
 * — `add .` from a plugin checkout would self-link the profile. Absolute
 * specs, registry names, and every other pnpm argument pass through
 * untouched.
 * @param argument - one pnpm argument, verbatim from argv.
 * @param cwd - the directory `dsh` was invoked from.
 * @returns the argument with a relative path spec anchored to `cwd`.
 */
function anchorPathSpec(argument: string, cwd: string): string {
  const match = /^(?<prefix>(?:file|link):)?(?<path>\.{1,2}(?:[/\\].*)?)$/.exec(argument)
  if (match?.groups?.path === undefined) return argument
  // A bare path stays bare and a prefixed spec keeps its prefix: pnpm's
  // link-vs-copy semantics differ between `file:` and a plain directory
  // path, and the anchor must not change which one the user asked for.
  const prefix = match.groups.prefix ?? ''
  return `${prefix}${resolve(cwd, match.groups.path)}`
}

/** One captured pnpm invocation: the exit code plus everything pnpm printed. */
interface PnpmAttempt {
  readonly exitCode: number
  readonly output: string
}

/**
 * Build-script keys pnpm ≥11 refused to run, parsed from one failed attempt's
 * output. pnpm reports two shapes: ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED prints
 * an example `allowBuilds:` block naming the git package by its resolved
 * tarball URL, and ERR_PNPM_IGNORED_BUILDS lists registry packages as a
 * comma-separated `name@version` line.
 * @param output - combined stdout and stderr of one pnpm run.
 * @returns candidate `allowBuilds` keys, deduplicated in first-seen order.
 */
function blockedBuildKeys(output: string): string[] {
  const keys: string[] = []
  const lines = output.split('\n')
  for (const [index, line] of lines.entries()) {
    if (line.trim() !== 'allowBuilds:') continue
    for (const entry of lines.slice(index + 1)) {
      const key = /^ {2}(?<key>\S.*?): true\s*$/.exec(entry)?.groups?.key
      if (key === undefined) break
      keys.push(key)
    }
  }
  const ignored = /Ignored build scripts: (?<list>[^\n]+)/.exec(output)?.groups?.list
  for (const entry of ignored?.split(/,\s*/) ?? []) {
    const key = entry.trim().replace(/\.$/, '')
    if (key !== '') keys.push(key)
  }
  return [...new Set(keys)]
}

/**
 * Merge keys into the profile's `allowBuilds` settings, preserving unrelated
 * pnpm-workspace.yaml settings. Also approves pnpm's own pending entries: on
 * ERR_PNPM_IGNORED_BUILDS pnpm records each blocked package as the placeholder
 * `<name>: set this to true or false`, and only that exact marker is flipped —
 * a user's explicit `false` stays `false`.
 * @param dir - the profile directory.
 * @param keys - candidate keys from {@link blockedBuildKeys}.
 * @returns the keys newly approved; empty when nothing changed.
 */
function allowBuilds(dir: string, keys: readonly string[]): string[] {
  const path = join(dir, 'pnpm-workspace.yaml')
  const parsed: unknown = load(readFileSync(path, 'utf8'))
  const settings = (typeof parsed === 'object' && parsed !== null ? parsed : {}) as Record<string, unknown>
  const allowed = (
    typeof settings.allowBuilds === 'object' && settings.allowBuilds !== null ? settings.allowBuilds : {}
  ) as Record<string, unknown>
  const changed: string[] = []
  for (const [key, value] of Object.entries(allowed)) {
    if (value === 'set this to true or false') {
      allowed[key] = true
      changed.push(key)
    }
  }
  for (const key of keys) {
    if (key in allowed) continue
    allowed[key] = true
    changed.push(key)
  }
  if (changed.length === 0) return []
  settings.allowBuilds = allowed
  writeFileSync(path, dump(settings))
  return changed
}
/**
 * Run one `dsh plugin` invocation: init if needed, forward to pnpm (retrying
 * past its build-script allowlist, since the explicit install command is
 * itself the user's trust decision), then reconcile.
 * @param profile - the profile name.
 * @param args - pnpm arguments with relative path specs anchored to the invoking directory.
 * @returns the pnpm exit code.
 */
export function runPlugin(profile: string, args: readonly string[]): number {
  const pnpmEntry = process.env.DSH_PNPM_ENTRY
  if (pnpmEntry !== undefined && (!isAbsolute(pnpmEntry) || !existsSync(pnpmEntry))) {
    process.stderr.write(`${NAME}: DSH_PNPM_ENTRY must name an existing absolute pnpm JavaScript entry\n`)
    return 127
  }
  const dir = resolveProfileDir(profile)
  if (!existsSync(join(dir, 'package.json'))) {
    initProfile(dir, PROFILE_TEMPLATES[profile] ?? DEFAULT_PROFILE_BUNDLES)
    process.stderr.write(`${NAME}: initialized profile ${profile} at ${dir}\n`)
  }
  const before = readProfileManifest(NAME, dir)
  const command = pnpmEntry === undefined ? 'pnpm' : process.execPath
  const commandArgs = [
    ...(pnpmEntry === undefined ? [] : [pnpmEntry]),
    ...args.map(argument => anchorPathSpec(argument, process.cwd())),
  ]
  // Windows resolves ordinary pnpm installs through a .cmd shim, which
  // spawn() refuses without a shell since the CVE-2024-27980 hardening. A
  // packaged desktop uses its Electron executable in Node mode and therefore
  // bypasses the shim.
  const shell = pnpmEntry === undefined && process.platform === 'win32'
  // Output is captured, then echoed, so one failed attempt can be scanned for
  // allowlist blocks without losing pnpm's diagnostics for the caller.
  const attempt = (): PnpmAttempt => {
    const result = spawnSync(command, commandArgs, { cwd: dir, shell, maxBuffer: 64 * 1024 * 1024 })
    if (result.error !== undefined) {
      const code = (result.error as NodeJS.ErrnoException).code
      if (code === 'ENOENT') {
        process.stderr.write(`${NAME}: pnpm not found on PATH — install pnpm to manage profile plugins\n`)
        return { exitCode: 127, output: '' }
      }
      throw result.error
    }
    const stdout = result.stdout.toString()
    const stderr = result.stderr.toString()
    if (stdout !== '') process.stdout.write(stdout)
    if (stderr !== '') process.stderr.write(stderr)
    return { exitCode: result.status ?? 1, output: `${stdout}\n${stderr}` }
  }
  // pnpm ≥11 hard-fails on build scripts outside its allowBuilds list — a git
  // plugin's prepare script first, then native transitive dependencies. Each
  // round allows the keys pnpm just named and retries; a round that adds
  // nothing is a genuine failure, not an allowlist block.
  let current = attempt()
  for (let rounds = 0; current.exitCode !== 0 && rounds < 3; rounds++) {
    const added = allowBuilds(dir, blockedBuildKeys(current.output))
    if (added.length === 0) break
    process.stderr.write(
      `${NAME}: allowed build scripts in ${join(dir, 'pnpm-workspace.yaml')}: ${added.join(', ')} — retrying\n`,
    )
    current = attempt()
  }
  const exitCode = current.exitCode
  if (exitCode === 0) {
    reconcilePlugins(before, dir)
  } else {
    // pnpm's own diagnostics name pnpm-workspace.yaml without saying WHICH
    // one; the profile owns it.
    process.stderr.write(`${NAME}: pnpm failed in profile directory ${dir}\n`)
    if (args.some(argument => /^git\+|^github:|\.git(?:#|$)|^https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+/.test(argument))) {
      process.stderr.write(
        `${NAME}: if pnpm blocked the git plugin's prepare script above, `
        + `add the exact key it printed under allowBuilds in ${join(dir, 'pnpm-workspace.yaml')}, then re-run\n`,
      )
    }
  }
  return exitCode
}
