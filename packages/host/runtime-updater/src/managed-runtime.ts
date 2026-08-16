/** Persistent pointer and validation helpers shared by the updater and Electron boot. */

import { randomBytes } from 'node:crypto'
import { constants } from 'node:fs'
import { access, lstat, mkdir, readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { valid } from 'semver'

/** Stable npm identity installed by the desktop runtime updater. */
export const DSH_RUNTIME_PACKAGE = '@deepseek-ai/dsh'
/** FUI bundle that every selectable managed runtime must carry. */
export const DSH_FUI_BUNDLE_PACKAGE = '@deepseek-ai/dsh-fui-app'
/** Web assets required by the loopback renderer. */
export const DSH_WEB_FRONTEND_PACKAGE = '@deepseek-ai/dsh-web-frontend'

const POINTER_FORMAT_VERSION = 1
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
  readonly installedAt: string
}

/** Validated managed runtime selected by the pointer file. */
export interface ManagedRuntimeCandidate {
  readonly version: string
  readonly root: string
  readonly cliEntry: string
  readonly frontendEntry: string
}

/**
 * Resolve paths owned by one exact managed runtime version.
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

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

function packageManifest(value: unknown, path: string): PackageManifest {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`desktop runtime manifest is not an object: ${path}`)
  }
  return value
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
    || typeof record.installedAt !== 'string'
    || Number.isNaN(Date.parse(record.installedAt))) {
    throw new Error('desktop runtime pointer has unsupported fields')
  }
  return {
    formatVersion: record.formatVersion,
    packageName: record.packageName,
    version: record.version,
    installedAt: record.installedAt,
  }
}

/**
 * Validate a runtime tree before installation commit or desktop boot.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @param version - Exact semver whose tree must be complete.
 * @returns validated paths for the selected version.
 */
export async function validateManagedRuntime(runtimeRoot: string, version: string): Promise<ManagedRuntimeCandidate> {
  const paths = managedRuntimePaths(runtimeRoot, version)
  const metadata = await lstat(paths.root)
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`desktop runtime version root is not a real directory: ${paths.root}`)
  }
  const cliManifestPath = join(paths.root, 'node_modules', '@deepseek-ai', 'dsh', 'package.json')
  const cliManifest = packageManifest(await readJson(cliManifestPath), cliManifestPath)
  if (cliManifest.name !== DSH_RUNTIME_PACKAGE || cliManifest.version !== version) {
    throw new Error(`desktop runtime package identity does not match ${DSH_RUNTIME_PACKAGE}@${version}`)
  }
  if (typeof cliManifest.dependencies?.[DSH_FUI_BUNDLE_PACKAGE] !== 'string') {
    throw new Error(`desktop runtime package does not declare ${DSH_FUI_BUNDLE_PACKAGE}`)
  }
  const fuiManifestPath = join(paths.root, 'node_modules', '@deepseek-ai', 'dsh-fui-app', 'package.json')
  const fuiManifest = packageManifest(await readJson(fuiManifestPath), fuiManifestPath)
  if (fuiManifest.name !== DSH_FUI_BUNDLE_PACKAGE || fuiManifest.version !== version) {
    throw new Error(`desktop runtime FUI bundle identity does not match ${DSH_FUI_BUNDLE_PACKAGE}@${version}`)
  }
  const frontendManifestPath = join(paths.root, 'node_modules', '@deepseek-ai', 'dsh-web-frontend', 'package.json')
  const frontendManifest = packageManifest(await readJson(frontendManifestPath), frontendManifestPath)
  if (frontendManifest.name !== DSH_WEB_FRONTEND_PACKAGE || frontendManifest.version !== version) {
    throw new Error(`desktop runtime frontend identity does not match ${DSH_WEB_FRONTEND_PACKAGE}@${version}`)
  }
  await Promise.all([
    access(paths.cliEntry, constants.R_OK),
    access(paths.frontendEntry, constants.R_OK),
  ])
  return paths
}

/**
 * Read and validate the currently selected managed runtime, if one exists.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @returns validated selected paths, or `undefined` when no pointer exists.
 */
export async function readManagedRuntime(runtimeRoot: string): Promise<ManagedRuntimeCandidate | undefined> {
  let raw: unknown
  try {
    raw = await readJson(join(runtimeRoot, POINTER_FILE))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
  const selected = pointer(raw)
  return validateManagedRuntime(runtimeRoot, selected.version)
}

/**
 * Atomically select one already validated managed runtime for the next launch.
 * @param runtimeRoot - Private desktop runtime storage root.
 * @param version - Exact validated version to select.
 */
export async function commitManagedRuntime(runtimeRoot: string, version: string): Promise<void> {
  await validateManagedRuntime(runtimeRoot, version)
  const next: RuntimePointer = {
    formatVersion: POINTER_FORMAT_VERSION,
    packageName: DSH_RUNTIME_PACKAGE,
    version,
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
