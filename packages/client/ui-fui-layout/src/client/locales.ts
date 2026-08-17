/** Simplified Chinese dictionary for FUI shell chrome. */
export const zh = {
  'skip.main': '跳至主要内容',
  'command.title': '智能体控制台',
} satisfies Record<string, string>

/** FUI shell dictionary key union. */
export type FuiLayoutKey = keyof typeof zh

/** English dictionary, checked against the Simplified Chinese key set. */
export const en = {
  'skip.main': 'Skip to main content',
  'command.title': 'Agent console',
} satisfies Record<FuiLayoutKey, string>
