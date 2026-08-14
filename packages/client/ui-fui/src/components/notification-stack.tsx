import { forwardRef, useEffect, useState } from 'react'
import { cn } from '../lib/cn.ts'

export type NotificationStackTone = 'primary' | 'ok' | 'warn' | 'accent'

export interface NotificationStackItem {
  /** 稳定标识,用于 key 与 onDismiss 回调 */
  id: string
  tone?: NotificationStackTone
  title: string
  message?: string
  /** 自动关闭毫秒数;省略时用容器的 duration,0 = 不自动关闭 */
  duration?: number
}

export interface NotificationStackProps {
  items: NotificationStackItem[]
  /** 条目自动关闭或被点掉时触发 */
  onDismiss?: ((id: string) => void) | undefined
  /** 默认自动关闭毫秒数,默认 4000;0 = 不自动关闭 */
  duration?: number
  /** 最多同时显示几条,默认 4;超出的旧条目不渲染 */
  max?: number
  /** 停靠角落,默认右下 */
  placement?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  className?: string
}

const toneBorderClass: Record<NotificationStackTone, string> = {
  primary: 'border-[var(--fui-primary-line)]',
  ok: 'border-[var(--fui-ok-line)]',
  warn: 'border-[var(--fui-warn-line)]',
  accent: 'border-[var(--fui-accent-line)]',
}

const toneTextClass: Record<NotificationStackTone, string> = {
  primary: 'text-[var(--fui-primary)]',
  ok: 'text-[var(--fui-ok)]',
  warn: 'text-[var(--fui-warn)]',
  accent: 'text-[var(--fui-accent)]',
}

/** accent / warn 为告警语义,用 assertive */
const assertiveTones: ReadonlySet<NotificationStackTone> = new Set([
  'warn',
  'accent',
])

const placementClass: Record<
  NonNullable<NotificationStackProps['placement']>,
  string
> = {
  'bottom-right': 'right-4 bottom-4 items-end',
  'bottom-left': 'bottom-4 left-4 items-start',
  'top-right': 'top-4 right-4 items-end',
  'top-left': 'top-4 left-4 items-start',
}

/** 单条:自己管进场动画与自动关闭计时 */
function StackedItem({
  item,
  duration,
  onDismiss,
}: {
  item: NotificationStackItem
  duration: number
  onDismiss?: ((id: string) => void) | undefined
}) {
  const [entered, setEntered] = useState(false)
  const tone = item.tone ?? 'primary'
  const ms = item.duration ?? duration

  useEffect(() => {
    const id = window.setTimeout(() => setEntered(true), 20)
    return () => window.clearTimeout(id)
  }, [])

  useEffect(() => {
    if (ms === 0 || !onDismiss) return
    const timer = window.setTimeout(() => onDismiss(item.id), ms)
    return () => window.clearTimeout(timer)
  }, [ms, onDismiss, item.id])

  const assertive = assertiveTones.has(tone)

  return (
    <div
      role={assertive ? 'alert' : 'status'}
      aria-live={assertive ? 'assertive' : 'polite'}
      data-tone={tone}
      data-id={item.id}
      className={cn(
        'w-80 border bg-fui-panel-solid p-3',
        'transition-all duration-200 motion-reduce:transition-none',
        entered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
        toneBorderClass[tone],
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'text-[10px] tracking-[0.2em] uppercase',
            toneTextClass[tone],
          )}
        >
          {item.title}
        </span>
        <button
          type="button"
          aria-label={`CLOSE ${item.title}`}
          onClick={() => onDismiss?.(item.id)}
          className={cn(
            'inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center',
            'text-[var(--fui-text-dim)] hover:bg-[var(--fui-neutral-soft)] hover:text-[var(--fui-text)]',
            'transition-colors duration-150 motion-reduce:transition-none',
          )}
        >
          ✕
        </button>
      </div>
      {item.message ? (
        <p className="mt-1 text-xs leading-normal text-[var(--fui-text)]">
          {item.message}
        </p>
      ) : null}
    </div>
  )
}

/**
 * 多条通知的堆叠容器:固定在屏幕一角,纵向排列,每条独立计时自动关闭。
 *
 * 纯受控 —— items 由调用方持有,容器只在到期或点击关闭时回调 onDismiss。
 * 超过 max 时丢弃最旧的几条(保留数组末尾,即最新的)。
 * 单条通知用 Notification;这里刻意重复了它的卡片样式,因为组件之间
 * 不互相 import 是复制粘贴分发的前提。
 */
export const NotificationStack = forwardRef<
  HTMLDivElement,
  NotificationStackProps
>(
  (
    {
      items,
      onDismiss,
      duration = 4000,
      max = 4,
      placement = 'bottom-right',
      className,
    },
    ref,
  ) => {
    const visible = max > 0 ? items.slice(-max) : []

    if (visible.length === 0) return null

    return (
      <div
        ref={ref}
        data-testid="fui-notification-stack"
        className={cn(
          'pointer-events-none fixed z-50 flex flex-col gap-2',
          placementClass[placement],
          className,
        )}
      >
        {visible.map(item => (
          // 容器整体 pointer-events-none 让底层可点,单条恢复可交互
          <div key={item.id} className="pointer-events-auto">
            <StackedItem
              item={item}
              duration={duration}
              onDismiss={onDismiss}
            />
          </div>
        ))}
      </div>
    )
  },
)

NotificationStack.displayName = 'NotificationStack'
