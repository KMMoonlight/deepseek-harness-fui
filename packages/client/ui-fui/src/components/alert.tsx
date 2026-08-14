import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export type AlertTone = 'primary' | 'ok' | 'warn' | 'accent'

export interface AlertProps {
  /** 竖条与标题色,默认 primary(青绿) */
  tone?: AlertTone
  /** 小字大写标题(如 WRN / SYS 风格,直接渲染文本) */
  title?: string
  children?: ReactNode
  className?: string
}

/**
 * FUI 风格行内警示条:左侧 2px 实色竖条 + 面板底色 +
 * 1px 细描边,无交互。tone 色值经 inline style 引用 var(--fui-*)。
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  ({ tone = 'primary', title, children, className }, ref) => {
    const toneStyle: CSSProperties = { background: `var(--fui-${tone})` }

    return (
      <div
        ref={ref}
        data-tone={tone}
        className={cn(
          'flex gap-3 border border-[var(--fui-line)] bg-[var(--fui-panel-bg)] p-3',
          className,
        )}
      >
        <span
          aria-hidden
          data-testid="fui-alert-bar"
          className="w-0.5 shrink-0 self-stretch"
          style={toneStyle}
        />
        <div className="flex min-w-0 flex-col gap-1">
          {title ? (
            <span
              className="text-[10px] uppercase tracking-[0.2em]"
              style={{ color: `var(--fui-${tone})` }}
            >
              {title}
            </span>
          ) : null}
          <div className="text-xs leading-normal text-[var(--fui-text)]">
            {children}
          </div>
        </div>
      </div>
    )
  },
)

Alert.displayName = 'Alert'
