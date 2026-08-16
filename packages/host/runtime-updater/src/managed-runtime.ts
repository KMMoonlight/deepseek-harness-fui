/** Persistent pointer and validation helpers shared by the updater and Electron boot. */

import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, lstat, mkdir, readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { satisfies, valid, validRange } from 'semver'

/** Stable official npm identity installed by the desktop runtime updater. */
export const DSH_RUNTIME_PACKAGE = '@deepseek-ai/dsh'
/** Application-owned FUI bundle copied into each managed official runtime. */
export const DSH_FUI_BUNDLE_PACKAGE = '@deepseek-ai/dsh-fui-app'
/** Application-owned Web assets required by the loopback renderer. */
export const DSH_WEB_FRONTEND_PACKAGE = '@deepseek-ai/dsh-web-frontend'

/** Application-owned packages overlaid onto an otherwise official DSH dependency tree. */
export const DSH_DESKTOP_OVERLAY_PACKAGES = [
  DSH_FUI_BUNDLE_PACKAGE,
  '@deepseek-ai/dsh-client-ui-fui',
  '@deepseek-ai/dsh-client-ui-fui-layout',
  '@deepseek-ai/dsh-client-ui-fui-surface',
  '@deepseek-ai/dsh-client-ui-settings-runtime-updater',
  '@deepseek-ai/dsh-host-runtime-updater',
  DSH_WEB_FRONTEND_PACKAGE,
] as const

const OVERLAY_REQUIRED_ENTRIES: Readonly<Record<(typeof DSH_DESKTOP_OVERLAY_PACKAGES)[number], string>> = {
  [DSH_FUI_BUNDLE_PACKAGE]: 'cordis.patch.yml',
  '@deepseek-ai/dsh-client-ui-fui': 'lib/index.js',
  '@deepseek-ai/dsh-client-ui-fui-layout': 'lib/client.js',
  '@deepseek-ai/dsh-client-ui-fui-surface': 'lib/client.js',
  '@deepseek-ai/dsh-client-ui-settings-runtime-updater': 'lib/client.js',
  '@deepseek-ai/dsh-host-runtime-updater': 'lib/index.js',
  [DSH_WEB_FRONTEND_PACKAGE]: 'dist/index.html',
}

const POINTER_FORMAT_VERSION = 2
const POINTER_FILE = 'current.json'

interface PackageManifest {
  readonly name?: unknown
  readonly version?: unknown
  readonly dependencies?: Readonly<Record<string, unknown>>
}

interface RuntimePointer {
  readonly formatVersion: number
  readonly packageName: string
  readonly version: string
  readonly fuiVersion: string
  readonly installedAt: string
}

/** Application release facts required to accept a managed official runtime. */
export interface ManagedRuntimeExpectations {
  /** Exact version of every application-owned FUI overlay package. */
  readonly fuiVersion: string
  /** Official DSH semver range supported by this FUI release. */
  readonly compatibleDshRange: string
}

/** Validated managed runtime selected by the pointer file. */
export interface ManagedRuntimeCandidate {
  readonly version: string
  readonly root: string
  readonly cliEntry: string
  readonly frontendEntry: string
}

/**
 * Resolve paths owned by one exact managed official DSH version.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @param version - Exact semver selected for the version directory.
 * @returns CLI, frontend, and version-root paths.
 */
export function managedRuntimePaths(runtimeRoot: string, version: string): ManagedRuntimeCandidate {
  if (valid(version) !== version) throw new Error(`desktop runtime version is not valid semver: ${version}`)
  const root = join(runtimeRoot, 'versions', version)
  return {
    version,
    root,
    cliEntry: join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    frontendEntry: join(root, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'dist', 'index.html'),
  }
}

/**
 * Resolve one fixed package identity below a node_modules root.
 * @param nodeModulesRoot - Absolute node_modules directory.
 * @param packageName - Unscoped or scoped npm package name.
 * @returns absolute package root below the supplied node_modules directory.
 */
export function nodeModulesPackageRoot(nodeModulesRoot: string, packageName: string): string {
  return join(nodeModulesRoot, ...packageName.split('/'))
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

function packageManifest(value: unknown, path: string): PackageManifest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`desktop runtime manifest is not an object: ${path}`)
  }
  return value
}

function validateExpectations(expectations: ManagedRuntimeExpectations): void {
  if (valid(expectations.fuiVersion) !== expectations.fuiVersion) {
    throw new Error(`desktop FUI version is not valid semver: ${expectations.fuiVersion}`)
  }
  if (validRange(expectations.compatibleDshRange) === null) {
    throw new Error(`desktop DSH compatibility is not a valid semver range: ${expectations.compatibleDshRange}`)
  }
}

function pointer(value: unknown): RuntimePointer {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('desktop runtime pointer is not an object')
  }
  const record = value as Partial<RuntimePointer>
  if (record.formatVersion !== POINTER_FORMAT_VERSION
    || record.packageName !== DSH_RUNTIME_PACKAGE
    || typeof record.version !== 'string'
    || valid(record.version) !== record.version
    || typeof record.fuiVersion !== 'string'
    || valid(record.fuiVersion) !== record.fuiVersion
    || typeof record.installedAt !== 'string'
    || Number.isNaN(Date.parse(record.installedAt))) {
    throw new Error('desktop runtime pointer has unsupported fields')
  }
  return {
    formatVersion: record.formatVersion,
    packageName: record.packageName,
    version: record.version,
    fuiVersion: record.fuiVersion,
    installedAt: record.installedAt,
  }
}

/**
 * Validate a composed runtime tree before installation commit or desktop boot.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @param version - Exact official DSH version whose tree must be complete.
 * @param expectations - Application-owned FUI version and supported DSH range.
 * @returns validated paths for the selected version.
 */
export async function validateManagedRuntime(
  runtimeRoot: string,
  version: string,
  expectations: ManagedRuntimeExpectations,
): Promise<ManagedRuntimeCandidate> {
  validateExpectations(expectations)
  if (!satisfies(version, expectations.compatibleDshRange, { includePrerelease: true })) {
    throw new Error(`official DSH ${version} is outside desktop compatibility ${expectations.compatibleDshRange}`)
  }
  const paths = managedRuntimePaths(runtimeRoot, version)
  const metadata = await lstat(paths.root)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`desktop runtime version root is not a real directory: ${paths.root}`)
  }
  const nodeModulesRoot = join(paths.root, 'node_modules')
  const cliManifestPath = join(nodeModulesPackageRoot(nodeModulesRoot, DSH_RUNTIME_PACKAGE), 'package.json')
  const cliManifest = packageManifest(await readJson(cliManifestPath), cliManifestPath)
  if (cliManifest.name !== DSH_RUNTIME_PACKAGE || cliManifest.version !== version) {
    throw new Error(`desktop runtime package identity does not match ${DSH_RUNTIME_PACKAGE}@${version}`)
  }
  if (cliManifest.dependencies?.[DSH_FUI_BUNDLE_PACKAGE] !== expectations.fuiVersion) {
    throw new Error(`desktop runtime does not select FUI overlay ${DSH_FUI_BUNDLE_PACKAGE}@${expectations.fuiVersion}`)
  }
  for (const packageName of DSH_DESKTOP_OVERLAY_PACKAGES) {
    const packageRoot = nodeModulesPackageRoot(nodeModulesRoot, packageName)
    const manifestPath = join(packageRoot, 'package.json')
    const manifest = packageManifest(await readJson(manifestPath), manifestPath)
    if (manifest.name !== packageName || manifest.version !== expectations.fuiVersion) {
      throw new Error(`desktop FUI overlay identity does not match ${packageName}@${expectations.fuiVersion}`)
    }
    await access(join(packageRoot, OVERLAY_REQUIRED_ENTRIES[packageName]), constants.R_OK)
  }
  await access(paths.cliEntry, constants.R_OK)
  return paths
}

/**
 * Read and validate the currently selected managed runtime, if one exists.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @param expectations - FUI version and official DSH range owned by this desktop release.
 * @returns validated selected paths, or `undefined` when no pointer exists.
 */
export async function readManagedRuntime(
  runtimeRoot: string,
  expectations: ManagedRuntimeExpectations,
): Promise<ManagedRuntimeCandidate | undefined> {
  let raw: unknown
  try {
    raw = await readJson(join(runtimeRoot, POINTER_FILE))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const selected = pointer(raw)
  if (selected.fuiVersion !== expectations.fuiVersion) {
    throw new Error(`desktop runtime FUI ${selected.fuiVersion} does not match application FUI ${expectations.fuiVersion}`)
  }
  return validateManagedRuntime(runtimeRoot, selected.version, expectations)
}

/**
 * Atomically select one already validated managed runtime for the next launch.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @param version - Exact validated official DSH version to select.
 * @param expectations - FUI version and official DSH range owned by this desktop release.
 */
export async function commitManagedRuntime(
  runtimeRoot: string,
  version: string,
  expectations: ManagedRuntimeExpectations,
): Promise<void> {
  await validateManagedRuntime(runtimeRoot, version, expectations)
  const next: RuntimePointer = {
    formatVersion: POINTER_FORMAT_VERSION,
    packageName: DSH_RUNTIME_PACKAGE,
    version,
    fuiVersion: expectations.fuiVersion,
    installedAt: new Date().toISOString(),
  }
  await writeFileAtomic(join(runtimeRoot, POINTER_FILE), `${JSON.stringify(next, null, 2)}\n`, {
    mode: 0o600,
    dirMode: 0o700,
  })
}

/**
 * Preserve a pointer rejected during Host startup and clear it from the active location.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @returns quarantine path, or `undefined` when no active pointer existed.
 */
export async function quarantineManagedRuntimePointer(runtimeRoot: string): Promise<string | undefined> {
  const current = join(runtimeRoot, POINTER_FILE)
  const failedRoot = join(runtimeRoot, 'failed')
  await mkdir(failedRoot, { recursive: true, mode: 0o700 })
  const destination = join(failedRoot, `current-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}.json`)
  try {
    await rename(current, destination)
    return destination
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}
