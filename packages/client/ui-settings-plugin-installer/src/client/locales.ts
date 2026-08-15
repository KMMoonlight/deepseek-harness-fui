/** Copy dictionaries for desktop plugin installation. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '安装插件',
  title: '从插件包安装',
  description: '输入 npm 包名、带版本的包名或 Git 地址。',
  specLabel: '插件包或 Git 地址',
  specPlaceholder: '@scope/plugin@latest 或 git+https://…',
  trustWarning: '插件可以在本机运行代码。只安装你信任的来源。',
  install: '安装',
  installing: '正在安装…',
  success: '安装完成',
  restart: '重启 DeepSeek FUI 后，新插件将加入当前 profile。',
  invalidSpec: '请输入一个有效的包名或 Git 地址。',
  busy: '另一个插件正在安装，请等它完成。',
  installFailed: '插件安装失败。',
  timedOut: '插件安装超时。',
  transportFailed: '桌面 Host 暂时无法执行安装。',
  diagnostics: '安装详情',
} satisfies Record<string, string>

/** Plugin installer locale key union. */
export type PluginInstallerLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Install plugin',
  title: 'Install from a plugin package',
  description: 'Enter an npm package, a versioned package, or a Git URL.',
  specLabel: 'Plugin package or Git URL',
  specPlaceholder: '@scope/plugin@latest or git+https://…',
  trustWarning: 'Plugins can run code on this computer. Install only from sources you trust.',
  install: 'Install',
  installing: 'Installing…',
  success: 'Installation complete',
  restart: 'Restart DeepSeek FUI to add the new plugin to the current profile.',
  invalidSpec: 'Enter one valid package or Git URL.',
  busy: 'Another plugin is being installed. Wait for it to finish.',
  installFailed: 'Plugin installation failed.',
  timedOut: 'Plugin installation timed out.',
  transportFailed: 'The desktop Host cannot run the installation right now.',
  diagnostics: 'Installation details',
} satisfies Record<PluginInstallerLocaleKey, string>
