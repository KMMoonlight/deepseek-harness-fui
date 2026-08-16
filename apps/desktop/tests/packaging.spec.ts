import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const desktopRoot = resolve(import.meta.dirname, '..')
const repositoryRoot = resolve(desktopRoot, '../..')
const desktopPackage = JSON.parse(readFileSync(resolve(desktopRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
  build: { extraResources: Array<{ from: string; to: string }> }
  dshDesktop: { compatibleDsh: string }
}
const runtimePackage = JSON.parse(readFileSync(resolve(desktopRoot, 'runtime/package.json'), 'utf8')) as {
  dependencies: Record<string, string>
}
const rootPackage = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}
const desktopMain = readFileSync(resolve(desktopRoot, 'src/main.ts'), 'utf8')
const desktopBuildConfig = readFileSync(resolve(desktopRoot, 'tsdown.config.ts'), 'utf8')
const desktopPreload = readFileSync(resolve(desktopRoot, 'src/preload.ts'), 'utf8')

describe('desktop packaging contract', () => {
  it('builds the FUI Host and Electron main process before packaging', () => {
    expect(desktopPackage.scripts.package).toContain('pnpm --workspace-root run build')
    expect(desktopPackage.scripts.package).toContain('pnpm run stage-runtime')
    expect(desktopPackage.scripts.package).toContain('electron-builder --dir')
    expect(rootPackage.scripts['package:desktop']).toBe('pnpm --filter @deepseek-ai/dsh-desktop run package')
  })

  it('ships the FUI bundle, CLI, frontend, and package manager in one runtime', () => {
    expect(desktopPackage.dshDesktop.compatibleDsh).toBe('>=0.1.0-rc.5 <0.2.0')
    expect(runtimePackage.dependencies).toMatchObject({
      '@deepseek-ai/dsh': 'workspace:^',
      '@deepseek-ai/dsh-fui-app': 'workspace:^',
      '@deepseek-ai/dsh-host-runtime-updater': 'workspace:^',
      '@deepseek-ai/dsh-client-ui-settings-runtime-updater': 'workspace:^',
      '@deepseek-ai/dsh-web-frontend': 'workspace:^',
      pnpm: '11.7.0',
    })
    expect(desktopPackage.build.extraResources).toContainEqual({
      from: 'runtime-host/node_modules',
      to: 'host/node_modules',
    })
  })

  it('loads the renderer marker through a CommonJS sandbox preload', () => {
    expect(desktopMain).toContain("preload: join(DESKTOP_DIR, 'lib/preload.cjs')")
    expect(desktopBuildConfig).toMatch(/entry: \['lib\/types\/preload\.js'\][\s\S]*?format: \['cjs'\]/)
    expect(desktopPreload).toContain("document.addEventListener('DOMContentLoaded', markDocument, { once: true })")
  })

  it('keeps the native window movable and resizable', () => {
    expect(desktopMain).toContain('movable: true')
    expect(desktopMain).toContain('resizable: true')
    expect(desktopMain).toContain('minimizable: true')
    expect(desktopMain).toContain('maximizable: true')
    expect(desktopMain).toContain('fullscreenable: true')
  })
})
