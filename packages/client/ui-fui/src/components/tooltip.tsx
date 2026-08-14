import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from 'react'
import { cn } from '../lib/cn.ts'

export type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipProps extends Omit<
  HTMLAttributes<HTMLSpanElement>,
  'content'
> {
  /** 气泡内容;为空时只渲染 trigger,不挂 aria-describedby */
  content?: ReactNode
  /** 气泡相对 trigger 的方位,默认 top */
  side?: TooltipSide
  /** 悬停多久后出现(ms),默认 200;聚焦触发不走延迟 */
  delay?: number
  /** 禁用后不再响应 hover / focus */
  disabled?: boolean
  /** 触发元素 */
  children: ReactNode
  className?: string
}

/** 气泡相对 trigger 的定位;方角薄边风格,不画箭头 */
const sideClass: Record<TooltipSide, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'top-1/2 right-full mr-1.5 -translate-y-1/2',
  right: 'top-1/2 left-full ml-1.5 -translate-y-1/2',
}

/**
 * FUI 风格提示气泡:方角 + 1px 钢蓝描边 + 不透明面板底色
 * (浮层不能用半透明 panel-bg,否则会透出下层颜色)。
 *
 * hover 延迟出现、focus 立即出现,Escape 关闭;role="tooltip" +
 * aria-describedby 关联,纯 CSS 定位不依赖任何定位库。
 */
export const Tooltip = forwardRef<HTMLSpanElement, TooltipProps>(
  (
    {
      content,
      side = 'top',
      delay = 200,
      disabled = false,
      children,
      className,
      ...rest
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false)
    const timer = useRef<number | undefined>(undefined)
    const id = useId()

    const clearTimer = useCallback(() => {
      if (timer.current !== undefined) {
        window.clearTimeout(timer.current)
        timer.current = undefined
      }
    }, [])

    // 卸载时清掉未触发的延迟,避免在已卸载组件上 setState
    useEffect(() => clearTimer, [clearTimer])

    const hasContent = content !== undefined && content !== null
    const active = open && hasContent && !disabled

    const show = useCallback(
      (immediate: boolean) => {
        if (disabled || !hasContent) return
        clearTimer()
        if (immediate || delay <= 0) {
          setOpen(true)
          return
        }
        timer.current = window.setTimeout(() => setOpen(true), delay)
      },
      [clearTimer, delay, disabled, hasContent],
    )

    const hide = useCallback(() => {
      clearTimer()
      setOpen(false)
    }, [clearTimer])

    return (
      <span
        ref={ref}
        className={cn('relative inline-flex', className)}
        onMouseEnter={() => show(false)}
        onMouseLeave={hide}
        onFocus={() => show(true)}
        onBlur={hide}
        onKeyDown={(event) => {
          if (event.key === 'Escape') hide()
        }}
        {...rest}
      >
        {/* trigger 包一层而不是克隆 children:克隆要求 children 必须转发 ref
            和事件,对复制粘贴场景太脆 */}
        <span
          aria-describedby={active ? id : undefined}
          className="inline-flex"
        >
          {children}
        </span>
        {active ? (
          <span
            id={id}
            role="tooltip"
            data-side={side}
            className={cn(
              'pointer-events-none absolute z-50 w-max max-w-56',
              'border border-[var(--fui-line)] bg-fui-panel-solid px-2 py-1',
              'text-[10px] leading-normal tracking-[0.12em] text-[var(--fui-text)]',
              sideClass[side],
            )}
          >
            {content}
          </span>
        ) : null}
      </span>
    )
  },
)

Tooltip.displayName = 'Tooltip'
