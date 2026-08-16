/** Copy dictionaries for managed desktop runtime updates. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  nav: '更新',
  title: '运行时更新',
  intro: '检查并安装 npm 上当前桌面兼容范围内的官方 DSH。',
  currentVersion: '当前版本',
  latestVersion: '最新版本',
  unchecked: '未检查',
  bundled: '应用内置',
  managed: '已更新',
  loading: '正在读取版本…',
  check: '检查更新',
  checking: '正在检查…',
  update: '立即更新',
  updating: '正在更新…',
  upToDate: '已经是可用的最新版本。',
  incompatible: '官方 DSH {version} 超出当前桌面兼容范围 {range}，请等待新的桌面版本。',
  installed: '运行时 {version} 已安装。完全退出并重新打开 DeepSeek FUI 后生效。',
  busy: '另一个运行时更新正在执行。',
  checkFailed: '无法检查 npm 更新。',
  installFailed: '运行时安装失败。',
  validationFailed: '下载的运行时未通过完整性检查。',
  timedOut: '运行时更新超时。',
  transportFailed: '桌面 Host 暂时无法执行更新。',
} satisfies Record<string, string>

/** Runtime updater locale key union. */
export type RuntimeUpdaterLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  nav: 'Updates',
  title: 'Runtime updates',
  intro: 'Check npm for official DSH updates and install versions supported by this desktop release.',
  currentVersion: 'Current version',
  latestVersion: 'Latest version',
  unchecked: 'Not checked',
  bundled: 'Bundled with app',
  managed: 'Managed update',
  loading: 'Reading version…',
  check: 'Check for updates',
  checking: 'Checking…',
  update: 'Update now',
  updating: 'Updating…',
  upToDate: 'The newest compatible runtime is already active.',
  incompatible: 'Official DSH {version} is outside this desktop release\'s compatible range {range}. Install a newer desktop release first.',
  installed: 'Runtime {version} is installed. Quit and reopen DeepSeek FUI to activate it.',
  busy: 'Another runtime update is already running.',
  checkFailed: 'Could not check npm for updates.',
  installFailed: 'Runtime installation failed.',
  validationFailed: 'The downloaded runtime failed validation.',
  timedOut: 'Runtime update timed out.',
  transportFailed: 'The desktop Host cannot run the update right now.',
} satisfies Record<RuntimeUpdaterLocaleKey, string>
