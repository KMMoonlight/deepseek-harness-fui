/** Copy dictionaries for managed desktop runtime updates. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  title: '桌面运行时',
  description: '检查 npm 上的官方 DSH，并在当前桌面兼容范围内安装到用户目录。',
  currentVersion: '当前版本',
  fuiVersion: '桌面 FUI 版本',
  compatibleDshRange: '兼容的官方 DSH',
  bundled: '应用内置',
  managed: '已更新',
  loading: '正在读取版本…',
  update: '检查并更新',
  updating: '正在检查并更新…',
  upToDate: '已经是可用的最新版本。',
  installed: '运行时 {version} 已安装。完全退出并重新打开 DeepSeek FUI 后生效。',
  incompatible: '官方 DSH {version} 超出当前桌面兼容范围 {range}，请等待新的桌面版本。',
  busy: '另一个运行时更新正在执行。',
  checkFailed: '无法检查 npm 更新。',
  installFailed: '运行时安装失败。',
  validationFailed: '下载的运行时未通过完整性检查。',
  timedOut: '运行时更新超时。',
  transportFailed: '桌面 Host 暂时无法执行更新。',
  diagnostics: '更新详情',
} satisfies Record<string, string>

/** Runtime updater locale key union. */
export type RuntimeUpdaterLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  title: 'Desktop runtime',
  description: 'Check npm for official DSH updates and install versions supported by this desktop release.',
  currentVersion: 'Current version',
  fuiVersion: 'Desktop FUI version',
  compatibleDshRange: 'Compatible official DSH',
  bundled: 'Bundled with app',
  managed: 'Managed update',
  loading: 'Reading version…',
  update: 'Check and update',
  updating: 'Checking and updating…',
  upToDate: 'The newest compatible runtime is already active.',
  installed: 'Runtime {version} is installed. Quit and reopen DeepSeek FUI to activate it.',
  incompatible: 'Official DSH {version} is outside this desktop release\'s compatible range {range}. Install a newer desktop release first.',
  busy: 'Another runtime update is already running.',
  checkFailed: 'Could not check npm for updates.',
  installFailed: 'Runtime installation failed.',
  validationFailed: 'The downloaded runtime failed validation.',
  timedOut: 'Runtime update timed out.',
  transportFailed: 'The desktop Host cannot run the update right now.',
  diagnostics: 'Update details',
} satisfies Record<RuntimeUpdaterLocaleKey, string>
