import { forwardRef } from 'react'
import { cn } from '../lib/cn.ts'

export interface DividerProps {
  /** 方向,默认 horizontal */
  orientation?: 'horizontal' | 'vertical'
  /** 仅 horizontal:渲染为 线-label-线 三段结构 */
  label?: string
  /** 虚线,默认 true(FUI 风格分隔线以虚线为主) */
  dashed?: boolean
  className?: string
}

const lineClass = (dashed: boolean, vertical: boolean) =>
  cn(
    vertical ? 'border-l' : 'border-t',
    'border-[var(--fui-line)]',
    dashed && 'border-dashed',
  )

/**
 * FUI 风格分隔线:1px 钢蓝,默认虚线。
 * horizontal 带 label 时为 线-label-线 三段;vertical 为 w-px 自撑高竖线。
 */
export const Divider = forwardRef<HTMLDivElement, DividerProps>(
  ({ orientation = 'horizontal', label, dashed = true, className }, ref) => {
    if (orientation === 'vertical') {
      return (
        <div
          ref={ref}
          role="separator"
          aria-orientation="vertical"
          className={cn(
            'w-px self-stretch',
            lineClass(dashed, true),
            className,
          )}
        />
      )
    }

    if (label) {
      return (
        <div
          ref={ref}
          role="separator"
          className={cn('flex items-center gap-2', className)}
        >
          <div aria-hidden className={cn('flex-1', lineClass(dashed, false))} />
          <span className="text-[9px] leading-none uppercase tracking-[0.3em] text-[var(--fui-text-dim)]">
            {label}
          </span>
          <div aria-hidden className={cn('flex-1', lineClass(dashed, false))} />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        role="separator"
        className={cn(lineClass(dashed, false), className)}
      />
    )
  },
)

Divider.displayName = 'Divider'
