import { forwardRef, useEffect, useState } from 'react'
import { cn } from '../lib/cn.ts'

export type NotificationTone = 'primary' | 'ok' | 'warn' | 'accent'

export interface NotificationProps {
  /** false 时不渲染 */
  open: boolean
  tone?: NotificationTone
  title: string
  message?: string
  /** 自动关闭毫秒数,默认 4000;0 = 不自动关闭 */
  duration?: number
  onClose?: () => void
  className?: string
}

/** 描边用对应色 55% 透明度(与 Button variant 同模式) */
const toneBorderClass: Record<NotificationTone, string> = {
  primary: 'border-[var(--fui-primary-line)]',
  ok: 'border-[var(--fui-ok-line)]',
  warn: 'border-[var(--fui-warn-line)]',
  accent: 'border-[var(--fui-accent-line)]',
}

/** accent / warn 为告警语义,用 assertive */
const assertiveTones: ReadonlySet<NotificationTone> = new Set([
  'warn',
  'accent',
])

/**
 * FUI 风格右下角通知:方角面板 + 1px 对应色描边 + 实色底,
 * 进场 opacity + translateY 200ms(reduced-motion 关闭过渡),
 * duration > 0 时自动调用 onClose。
 */
export const Notification = forwardRef<HTMLDivElement, NotificationProps>(
  (
    {
      open,
      tone = 'primary',
      title,
      message,
      duration = 4000,
      onClose,
      className,
    },
    ref,
  ) => {
    const [entered, setEntered] = useState(false)

    useEffect(() => {
      if (!open) {
        setEntered(false)
        return
      }
      const id = window.setTimeout(() => setEntered(true), 20)
      return () => window.clearTimeout(id)
    }, [open])

    useEffect(() => {
      if (!open || duration === 0 || !onClose) return
      const id = window.setTimeout(onClose, duration)
      return () => window.clearTimeout(id)
    }, [open, duration, onClose])

    if (!open) return null

    const assertive = assertiveTones.has(tone)

    return (
      <div
        ref={ref}
        role={assertive ? 'alert' : 'status'}
        aria-live={assertive ? 'assertive' : 'polite'}
        data-tone={tone}
        className={cn(
          'fixed right-4 bottom-4 z-50 w-80 border bg-fui-panel-solid p-3',
          'transition-all duration-200 motion-reduce:transition-none',
          entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
          toneBorderClass[tone],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: `var(--fui-${tone})` }}
          >
            {title}
          </span>
          <button
            type="button"
            aria-label="CLOSE"
            onClick={onClose}
            className={cn(
              'inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center',
              'text-[var(--fui-text-dim)] hover:bg-[var(--fui-neutral-soft)] hover:text-[var(--fui-text)]',
              'transition-colors duration-150 motion-reduce:transition-none',
            )}
          >
            ✕
          </button>
        </div>
        {message ? (
          <p className="mt-1 text-xs leading-normal text-[var(--fui-text)]">
            {message}
          </p>
        ) : null}
      </div>
    )
  },
)

Notification.displayName = 'Notification'
