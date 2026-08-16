/** Electron application shell for the loopback DeepSeek FUI Host. */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { quarantineManagedRuntimePointer } from '@deepseek-ai/dsh-host-runtime-updater/managed-runtime'
import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  session,
  shell,
  Tray,
  type Event,
  type MenuItemConstructorOptions,
} from 'electron'
import { createHostSupervisor, spawnDshFui, type HostSupervisor } from './host-supervisor.ts'
import { selectRuntimeCandidates } from './runtime-selection.ts'
import { createDesktopLifecycle, type DesktopLifecycle } from './window-lifecycle.ts'

const APP_NAME = 'DeepSeek FUI'
const WINDOW_WIDTH = 1440
const WINDOW_HEIGHT = 920
const DESKTOP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const REPOSITORY_ROOT = resolve(DESKTOP_DIR, '../..')

interface HostPaths {
  readonly nodeExecutable: string
  readonly cliEntry: string
  readonly pnpmEntry?: string
  readonly cwd: string
  readonly electronRunAsNode: boolean
  readonly runtimeRoot: string
  readonly version: string
  readonly fuiVersion: string
  readonly compatibleDshRange: string
  readonly overlayRoot: string
  readonly source: 'bundled' | 'managed'
}

let mainWindow: BrowserWindow | undefined
let tray: Tray | undefined
let host: HostSupervisor | undefined
let lifecycle: DesktopLifecycle | undefined
let hostOrigin: string | undefined
let bootQuitPromise: Promise<void> | undefined
let quitReleased = false

function packageVersion(cliEntry: string): string {
  const manifestPath = resolve(dirname(cliEntry), '../package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown }
  if (typeof manifest.version !== 'string') {
    throw new Error(`desktop Host manifest has no version: ${manifestPath}`)
  }
  return manifest.version
}

function manifestVersion(manifestPath: string): string {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version?: unknown }
  if (typeof manifest.version !== 'string') {
    throw new Error(`desktop package manifest has no version: ${manifestPath}`)
  }
  return manifest.version
}

function compatibleDshRange(): string {
  const manifestPath = join(DESKTOP_DIR, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dshDesktop?: { compatibleDsh?: unknown }
  }
  const range = manifest.dshDesktop?.compatibleDsh
  if (typeof range !== 'string') {
    throw new Error(`desktop manifest has no dshDesktop.compatibleDsh: ${manifestPath}`)
  }
  return range
}

/** Resolve the immutable checkout or packaged fallback runtime. */
function bundledHostPaths(): HostPaths {
  const runtimeRoot = dshHomePath('desktop-runtime')
  const overlayRoot = app.isPackaged
    ? join(process.resourcesPath, 'host/node_modules')
    : join(DESKTOP_DIR, 'runtime/node_modules')
  const fuiVersion = manifestVersion(join(overlayRoot, '@deepseek-ai/dsh-fui-app/package.json'))
  const dshRange = compatibleDshRange()
  if (!app.isPackaged) {
    const cliEntry = join(REPOSITORY_ROOT, 'apps/cli/lib/bin.js')
    return {
      nodeExecutable: process.env.DSH_DESKTOP_NODE_EXECUTABLE ?? 'node',
      cliEntry,
      pnpmEntry: join(overlayRoot, 'pnpm/bin/pnpm.cjs'),
      cwd: process.cwd(),
      electronRunAsNode: false,
      runtimeRoot,
      version: packageVersion(cliEntry),
      fuiVersion,
      compatibleDshRange: dshRange,
      overlayRoot,
      source: 'bundled',
    }
  }
  const cliEntry = join(process.resourcesPath, 'host/node_modules/@deepseek-ai/dsh/lib/bin.js')
  return {
    nodeExecutable: process.execPath,
    cliEntry,
    pnpmEntry: join(process.resourcesPath, 'host/node_modules/pnpm/bin/pnpm.cjs'),
    cwd: app.getPath('home'),
    electronRunAsNode: true,
    runtimeRoot,
    version: packageVersion(cliEntry),
    fuiVersion,
    compatibleDshRange: dshRange,
    overlayRoot,
    source: 'bundled',
  }
}

/** Prefer a validated managed runtime while retaining the packaged baseline. */
async function hostCandidates(): Promise<readonly HostPaths[]> {
  const bundled = bundledHostPaths()
  if (!app.isPackaged) return [bundled]
  return selectRuntimeCandidates(bundled)
}

function assertHostArtifacts(paths: HostPaths): void {
  if (isAbsolute(paths.nodeExecutable) && !existsSync(paths.nodeExecutable)) {
    throw new Error(`desktop Node runtime is missing: ${paths.nodeExecutable}`)
  }
  if (!existsSync(paths.cliEntry)) {
    throw new Error(`desktop Host entry is missing: ${paths.cliEntry}; run pnpm run build first`)
  }
  if (paths.pnpmEntry !== undefined && !existsSync(paths.pnpmEntry)) {
    throw new Error(`desktop plugin package manager is missing: ${paths.pnpmEntry}`)
  }
}

/** Load the application icon, with an empty fallback for incomplete staging. */
function applicationImage(): Electron.NativeImage {
  const candidates = app.isPackaged
    ? [join(process.resourcesPath, 'desktop-resources/icon.png')]
    : [join(DESKTOP_DIR, 'resources/icon.png')]
  const path = candidates.find(candidate => existsSync(candidate))
  return path === undefined ? nativeImage.createEmpty() : nativeImage.createFromPath(path)
}

function isExternalUrl(raw: string): boolean {
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function hasOrigin(raw: string, expected: string): boolean {
  try {
    return new URL(raw).origin === expected
  } catch {
    return false
  }
}

/** Install navigation and permission policy before the first renderer loads. */
function hardenSession(): void {
  const desktopSession = session.defaultSession
  desktopSession.setPermissionCheckHandler(() => false)
  desktopSession.setPermissionRequestHandler((_webContents, _permission, callback) => { callback(false) })
}

async function createMainWindow(): Promise<BrowserWindow> {
  const origin = hostOrigin
  if (origin === undefined) throw new Error('desktop Host is not ready')
  const window = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 960,
    minHeight: 640,
    movable: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    fullscreenable: true,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin' ? {
      titleBarStyle: 'hiddenInset' as const,
      trafficLightPosition: { x: 16, y: 13 },
    } : {}),
    title: APP_NAME,
    icon: applicationImage(),
    backgroundColor: '#101214',
    webPreferences: {
      preload: join(DESKTOP_DIR, 'lib/preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })
  mainWindow = window
  window.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error(`desktop preload failed (${preloadPath}):`, error)
  })
  window.on('close', (event) => { lifecycle?.onWindowClose(event) })
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = undefined
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (hasOrigin(url, origin)) return
    event.preventDefault()
    if (isExternalUrl(url)) void shell.openExternal(url)
  })
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  await window.loadURL(origin)
  if (!lifecycle?.isQuitting) window.show()
  return window
}

function createTray(): void {
  const image = applicationImage().resize({ width: 18, height: 18 })
  if (process.platform === 'darwin') image.setTemplateImage(true)
  tray = new Tray(image)
  tray.setToolTip(APP_NAME)
  const template: MenuItemConstructorOptions[] = [
    { label: '打开主窗口', click: () => { void lifecycle?.showWindow() } },
    { type: 'separator' },
    { label: '退出', click: () => { void requestAppQuit() } },
  ]
  tray.setContextMenu(Menu.buildFromTemplate(template))
  tray.on('click', () => { void lifecycle?.showWindow() })
}

function releaseAppQuit(): void {
  quitReleased = true
  tray?.destroy()
  tray = undefined
  app.quit()
}

/** Join explicit quit requests even while the Host or window is still starting. */
function requestAppQuit(): Promise<void> {
  if (lifecycle !== undefined) return lifecycle.requestQuit()
  bootQuitPromise ??= (host?.shutdown() ?? Promise.resolve()).catch((error: unknown) => {
    console.error('desktop shutdown failed:', error)
  }).then(() => {
    releaseAppQuit()
  })
  return bootQuitPromise
}

async function boot(): Promise<void> {
  if (bootQuitPromise !== undefined) return
  const candidates = await hostCandidates()
  const failures: unknown[] = []
  for (const paths of candidates) {
    try {
      assertHostArtifacts(paths)
      const candidate = createHostSupervisor({
        spawnHost: () => spawnDshFui({
          ...paths,
          env: {
            ...process.env,
            DSH_DESKTOP: '1',
            DSH_DESKTOP_CLI_ENTRY: paths.cliEntry,
            DSH_DESKTOP_RUNTIME_ROOT: paths.runtimeRoot,
            DSH_DESKTOP_RUNTIME_SOURCE: paths.source,
            DSH_DESKTOP_RUNTIME_VERSION: paths.version,
            DSH_DESKTOP_FUI_VERSION: paths.fuiVersion,
            DSH_DESKTOP_DSH_COMPATIBILITY: paths.compatibleDshRange,
            DSH_DESKTOP_OVERLAY_ROOT: paths.overlayRoot,
            ...(paths.pnpmEntry === undefined ? {} : { DSH_PNPM_ENTRY: paths.pnpmEntry }),
          },
        }),
        log: chunk => process.stderr.write(chunk),
        onUnexpectedExit: ({ code, signal }) => {
          console.error(`desktop Host exited unexpectedly (code ${String(code)}, signal ${String(signal)})`)
          void requestAppQuit()
        },
      })
      host = candidate
      hostOrigin = await candidate.start()
      break
    } catch (error) {
      failures.push(error)
      await host?.shutdown().catch((shutdownError: unknown) => { failures.push(shutdownError) })
      host = undefined
      if (paths.source === 'managed') {
        console.error(`desktop managed runtime ${paths.version} failed to start; using the bundled runtime:`, error)
        await quarantineManagedRuntimePointer(paths.runtimeRoot).catch((quarantineError: unknown) => {
          console.error('desktop failed to quarantine the rejected runtime pointer:', quarantineError)
        })
      }
    }
  }
  if (hostOrigin === undefined) {
    throw new AggregateError(failures, 'desktop could not start a managed or bundled Host runtime')
  }
  hardenSession()
  lifecycle = createDesktopLifecycle({
    getWindow: () => mainWindow,
    createWindow: createMainWindow,
    disposeHost: async () => { await host?.shutdown() },
    quit: releaseAppQuit,
    reportError: (error) => { console.error('desktop shutdown failed:', error) },
  })
  createTray()
  await lifecycle.showWindow()
}

app.setName(APP_NAME)
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => { void lifecycle?.showWindow() })
  app.on('activate', () => { void lifecycle?.showWindow() })
  app.on('window-all-closed', () => {
    // Tray and Host own application lifetime on every platform.
  })
  app.on('before-quit', (event: Event) => {
    if (quitReleased) return
    event.preventDefault()
    void requestAppQuit()
  })
  app.whenReady().then(boot).catch(async (error: unknown) => {
    console.error('desktop startup failed:', error)
    if (bootQuitPromise === undefined) {
      await dialog.showMessageBox({
        type: 'error',
        title: `${APP_NAME} 启动失败`,
        message: error instanceof Error ? error.message : String(error),
      })
    }
    await requestAppQuit()
  })
}
