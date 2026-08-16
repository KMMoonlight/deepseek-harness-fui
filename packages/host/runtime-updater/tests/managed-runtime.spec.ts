import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  commitManagedRuntime,
  DSH_DESKTOP_OVERLAY_PACKAGES,
  DSH_FUI_BUNDLE_PACKAGE,
  DSH_RUNTIME_PACKAGE,
  managedRuntimePaths,
  nodeModulesPackageRoot,
  quarantineManagedRuntimePointer,
  readManagedRuntime,
  validateManagedRuntime,
  type ManagedRuntimeExpectations,
} from '../src/managed-runtime.ts'

const roots: string[] = []
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

async function writeRuntime(runtimeRoot: string, dshVersion = '1.2.3', fuiVersion = expectations.fuiVersion): Promise<void> {
  const paths = managedRuntimePaths(runtimeRoot, dshVersion)
  const nodeModulesRoot = join(paths.root, 'node_modules')
  const dshRoot = nodeModulesPackageRoot(nodeModulesRoot, DSH_RUNTIME_PACKAGE)
  await writeJson(join(dshRoot, 'package.json'), {
    name: DSH_RUNTIME_PACKAGE,
    version: dshVersion,
    dependencies: { [DSH_FUI_BUNDLE_PACKAGE]: fuiVersion },
  })
  await mkdir(dirname(paths.cliEntry), { recursive: true })
  await writeFile(paths.cliEntry, '#!/usr/bin/env node\n')
  for (const packageName of DSH_DESKTOP_OVERLAY_PACKAGES) {
    const packageRoot = nodeModulesPackageRoot(nodeModulesRoot, packageName)
    await writeJson(join(packageRoot, 'package.json'), { name: packageName, version: fuiVersion })
    const entry = join(packageRoot, overlayEntries[packageName])
    await mkdir(dirname(entry), { recursive: true })
    await writeFile(entry, packageName === '@deepseek-ai/dsh-web-frontend' ? '<!doctype html>\n' : '// fixture\n')
  }
}

describe('managed desktop runtime storage', () => {
  it('validates official DSH plus the application overlay and atomically selects it', async () => {
    const runtimeRoot = await root()
    await writeRuntime(runtimeRoot)

    await expect(validateManagedRuntime(runtimeRoot, '1.2.3', expectations)).resolves.toEqual(
      managedRuntimePaths(runtimeRoot, '1.2.3'),
    )
    await commitManagedRuntime(runtimeRoot, '1.2.3', expectations)
    await expect(readManagedRuntime(runtimeRoot, expectations)).resolves.toEqual(managedRuntimePaths(runtimeRoot, '1.2.3'))

    const pointer = JSON.parse(await readFile(join(runtimeRoot, 'current.json'), 'utf8')) as Record<string, unknown>
    expect(pointer).toMatchObject({
      formatVersion: 2,
      packageName: DSH_RUNTIME_PACKAGE,
      version: '1.2.3',
      fuiVersion: expectations.fuiVersion,
    })
    expect(Date.parse(String(pointer.installedAt))).not.toBeNaN()
  })

  it('accepts a newer official prerelease inside the desktop release range', async () => {
    const runtimeRoot = await root()
    await writeRuntime(runtimeRoot, '0.1.0-rc.6')
    await expect(validateManagedRuntime(runtimeRoot, '0.1.0-rc.6', {
      ...expectations,
      compatibleDshRange: '>=0.1.0-rc.5 <0.2.0',
    })).resolves.toEqual(managedRuntimePaths(runtimeRoot, '0.1.0-rc.6'))
  })

  it('treats an absent pointer as no managed runtime and preserves a quarantined pointer', async () => {
    const runtimeRoot = await root()
    await expect(readManagedRuntime(runtimeRoot, expectations)).resolves.toBeUndefined()
    await expect(quarantineManagedRuntimePointer(runtimeRoot)).resolves.toBeUndefined()

    await writeRuntime(runtimeRoot)
    await commitManagedRuntime(runtimeRoot, '1.2.3', expectations)
    const destination = await quarantineManagedRuntimePointer(runtimeRoot)
    expect(destination).toContain(join(runtimeRoot, 'failed', 'current-'))
    await expect(readFile(destination!, 'utf8')).resolves.toContain('"fuiVersion": "7.0.0"')
    await expect(readManagedRuntime(runtimeRoot, expectations)).resolves.toBeUndefined()
  })

  it('rejects stale pointers, incompatible DSH, wrong overlay identities, and incomplete entries', async () => {
    const runtimeRoot = await root()
    expect(() => managedRuntimePaths(runtimeRoot, '../1.2.3')).toThrow('not valid semver')
    await writeFile(join(runtimeRoot, 'current.json'), '{"formatVersion":1}\n')
    await expect(readManagedRuntime(runtimeRoot, expectations)).rejects.toThrow('unsupported fields')

    await writeRuntime(runtimeRoot)
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3', {
      ...expectations,
      compatibleDshRange: '>=2.0.0 <3.0.0',
    })).rejects.toThrow('outside desktop compatibility')

    const paths = managedRuntimePaths(runtimeRoot, '1.2.3')
    const fuiManifest = join(paths.root, 'node_modules/@deepseek-ai/dsh-fui-app/package.json')
    await writeJson(fuiManifest, { name: DSH_FUI_BUNDLE_PACKAGE, version: '7.0.1' })
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3', expectations)).rejects.toThrow('overlay identity')

    await writeRuntime(runtimeRoot)
    await rm(paths.frontendEntry)
    await expect(validateManagedRuntime(runtimeRoot, '1.2.3', expectations)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a pointer from another FUI release and a symlinked version root', async () => {
    const runtimeRoot = await root()
    await writeRuntime(runtimeRoot)
    await commitManagedRuntime(runtimeRoot, '1.2.3', expectations)
    await expect(readManagedRuntime(runtimeRoot, {
      ...expectations,
      fuiVersion: '7.1.0',
    })).rejects.toThrow('does not match application FUI')

    const linkedRoot = await root()
    const target = await root()
    const paths = managedRuntimePaths(linkedRoot, '1.2.3')
    await mkdir(dirname(paths.root), { recursive: true })
    await symlink(target, paths.root)
    await expect(validateManagedRuntime(linkedRoot, '1.2.3', expectations)).rejects.toThrow('not a real directory')
  })
})
