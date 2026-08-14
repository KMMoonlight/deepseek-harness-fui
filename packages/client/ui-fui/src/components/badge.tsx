import { forwardRef, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export type BadgeTone =
  'primary' | 'ok' | 'warn' | 'accent' | 'danger' | 'neutral'

export interface BadgeProps {
  /** 语义色,默认 neutral(钢蓝描边 + 次要文字) */
  tone?: BadgeTone
  children?: ReactNode
  className?: string
}

/**
 * FUI 风格状态徽标:方角小条,1px 描边(55% 对应色)+ 8% 同色底
 * + 对应色小字,全大写宽字距。文字前方形状态点(bg-current,与文字同色)。
 * 纯展示,无交互、无辉光。
 */
const toneClass: Record<BadgeTone, string> = {
  primary:
    'border-[var(--fui-primary-line)] bg-[var(--fui-primary-soft)] text-[var(--fui-primary)]',
  ok: 'border-[var(--fui-ok-line)] bg-[var(--fui-ok-soft)] text-[var(--fui-ok)]',
  warn: 'border-[var(--fui-warn-line)] bg-[var(--fui-warn-soft)] text-[var(--fui-warn)]',
  accent:
    'border-[var(--fui-accent-line)] bg-[var(--fui-accent-soft)] text-[var(--fui-accent)]',
  danger:
    'border-[var(--fui-danger-line)] bg-[var(--fui-danger-soft)] text-[var(--fui-danger)]',
  neutral:
    'border-[var(--fui-neutral-line)] bg-[var(--fui-neutral-soft)] text-[var(--fui-text-dim)]',
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ tone = 'neutral', children, className }, ref) => {
    return (
      <span
        ref={ref}
        data-tone={tone}
        className={cn(
          'inline-flex h-5 items-center gap-1.5 border px-1.5 text-[9px] leading-none tracking-[0.2em] uppercase',
          toneClass[tone],
          className,
        )}
      >
        {/* 状态点:方形,bg-current 跟随 tone 文字色 */}
        <span
          aria-hidden
          data-testid="fui-badge-dot"
          className="h-1.5 w-1.5 bg-current"
        />
        {children}
      </span>
    )
  },
)

Badge.displayName = 'Badge'
