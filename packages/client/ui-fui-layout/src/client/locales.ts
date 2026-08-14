/** Simplified Chinese dictionary for FUI shell chrome. */
export const zh = {
  'skip.main': '跳至主要内容',
  'command.title': '智能体控制台',
  'command.session': '会话链路',
  'session.syncing': '同步中',
  'session.idle': '待命',
  'session.running': '执行中',
  'session.ready': '就绪',
  'status.profile': '配置 / FUI',
  'status.workspace': '本地工作区',
} satisfies Record<string, string>

/** FUI shell dictionary key union. */
export type FuiLayoutKey = keyof typeof zh

/** English dictionary, checked against the Simplified Chinese key set. */
export const en = {
  'skip.main': 'Skip to main content',
  'command.title': 'Agent console',
  'command.session': 'Session link',
  'session.syncing': 'Syncing',
  'session.idle': 'Standby',
  'session.running': 'Running',
  'session.ready': 'Ready',
  'status.profile': 'Profile / FUI',
  'status.workspace': 'Local workspace',
} satisfies Record<FuiLayoutKey, string>
