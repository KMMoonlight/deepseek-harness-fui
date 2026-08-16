import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  commitManagedRuntime,
  DSH_FUI_BUNDLE_PACKAGE,
  DSH_RUNTIME_PACKAGE,
  DSH_WEB_FRONTEND_PACKAGE,
  managedRuntimePaths,
  quarantineManagedRuntimePointer,
  readManagedRuntime,
  validateManagedRuntime,
} from '../src/managed-runtime.ts'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true })))
})

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), 'dsh-runtime-updater-'))
  roots.push(value)
  return value
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(value)}\n`)
}

async function writeRuntime(runtimeRoot: string, version = '1.2.3'): Promise<void> {
  const paths = managedRuntimePaths(runtimeRoot, version)
  const packageRoot = join(paths.root, 'node_modules', '@deepseek-ai')
  await writeJson(join(packageRoot, 'dsh/package.json'), {
    name: DSH_RUNTIME_PACKAGE,
    version,
    dependencies: { [DSH_FUI_BUNDLE_PACKAGE]: `^${version}` },
  })
  await writeJson(join(packageRoot, 'dsh-fui-app/package.json'), {
    name: DSH_FUI_BUNDLE_PACKAGE,
    version,
  })
  await writeJson(join(packageRoot, 'dsh-web-frontend/package.json'), {
    name: DSH_WEB_FRONTEND_PACKAGE,
    version,
  })
  await mkdir(dirname(paths.cliEntry), { recursive: true })
  await mkdir(dirname(paths.frontendEntry), { recursive: true })
  await writeFile(paths.cliEntry, '#!/usr/bin/env node\n')
  await writeFile(paths.frontendEntry, '<!doctype html>\n')
}

describe('managed desktop runtime storage', () => {
  it('validates exact package identities and atomically selects one complete tree', async () => {
    const runtimeRoot = await root()
    await writeRuntime(runtimeRoot)

    await expect(validateManagedRuntime(runtimeRoot, '1.2.3')).resolves.toEqual(
      managedRuntimePaths(runtimeRoot, '1.2.3'),
    )
    await commitManagedRuntime(runtimeRoot, '1.2.3')
    await expect(readManagedRuntime(runtimeRoot)).resolves.toEqual(managedRuntimePaths(runtimeRoot, '1.2.3'))

    const pointer = JSON.parse(await readFile(join(runtimeRoot, 'current.json'), 'utf8')) as Record<string, unknown>
    expect(pointer).toMatchObject({ formatVersion: 1, packageName: DSH_RUNTIME_PACKAGE, version: '1.2.3' })
    expect(Date.parse(String(pointer.installedAt))).not.toBeNaN()
  })

  it('treats an absent pointer as no managed runtime and preserves a quarantined pointer', async () => {
    const runtimeRoot = await root()
    await expect(readManagedRuntime(runtimeRoot)).resolves.toBeUndefined()
    await expect(quarantineManagedRuntimePointer(runtimeRoot)).resolves.toBeUndefined()

    await writeRuntime(runtimeRoot)
    await commitManagedRuntime(runtimeRoot, '1.2.3')
    const destination = await quarantineManagedRuntimePointer(runtimeRoot)
    expect(destination).toContain(join(runtimeRoot, 'failed', 'current-'))
    await expect(readFile(destination!, 'utf8')).resolves.toContain('"version": "1.2.3"')
    await expect(readManagedRuntime(runtimeRoot)).resolves.toBeUndefined()
  })

  it('rejects malformed versions, pointers, package identities, and incomplete entries', async () => {
    const runtimeRoot = await root()
    expect(() => managedRuntimePaths(runtimeRoot, '../1.2.3')).toThrow('not valid semver')
    await writeFile(join(runtimeRoot, 'current.json'), '{"formatVersion":2}\n')
    await expect(readManagedRuntime(runtimeRoot)).rejects.toThrow('unsupported fields')

    await writeRuntime(runtimeRoot)
    const paths = managedRuntimePaths(runtimeRoot, '1.2.3')
    const cliManifest = join(paths.root, 'node_modules/@deepseek-ai/dsh/package.json')
    await writeJson(cliManifest, { name: DSH_RUNTIME_PACKAGE, version: '1.2.4', dependencies: {} })
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3')).rejects.toThrow('package identity')

    await writeRuntime(runtimeRoot)
    await writeJson(cliManifest, { name: DSH_RUNTIME_PACKAGE, version: '1.2.3', dependencies: {} })
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3')).rejects.toThrow('does not declare')

    await writeRuntime(runtimeRoot)
    await rm(paths.frontendEntry)
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3')).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a symlink in place of the version root', async () => {
    const runtimeRoot = await root()
    const target = await root()
    const paths = managedRuntimePaths(runtimeRoot, '1.2.3')
    await mkdir(dirname(paths.root), { recursive: true })
    await symlink(target, paths.root)
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3')).rejects.toThrow('not a real directory')
  })
})
