import { forwardRef, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export type CardTone = 'default' | 'accent' | 'warn'

export interface CardProps {
  /** 内部标题行:dim 小字大写,右侧可放 action */
  title?: string
  /** 标题行右侧内容 */
  action?: ReactNode
  /** 底部区域:上方 1px dashed 分隔线,内容 dim 小字 */
  footer?: ReactNode
  /** 1px 描边色,default = var(--fui-line) */
  tone?: CardTone
  className?: string
  children?: ReactNode
}

const toneBorder: Record<CardTone, string> = {
  default: 'border-[var(--fui-line)]',
  accent: 'border-[var(--fui-accent)]',
  warn: 'border-[var(--fui-warn)]',
}

/**
 * FUI 风格卡片:方角 + 1px 薄描边 + 面板底色,无辉光。
 * 与 Panel 的区别:标题在内部标题行(dim 小字大写,下接 dashed 分隔线),
 * 不骑边框。
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ title, action, footer, tone = 'default', className, children }, ref) => {
    return (
      <div
        ref={ref}
        data-tone={tone}
        className={cn(
          'border bg-[var(--fui-panel-bg)]',
          toneBorder[tone],
          className,
        )}
      >
        {title || action ? (
          <div
            data-testid="fui-card-header"
            className="flex items-center justify-between gap-2 border-b border-dashed border-[var(--fui-line)] px-4 py-2"
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-[var(--fui-text-dim)]">
              {title}
            </span>
            {action}
          </div>
        ) : null}
        <div className="p-4">{children}</div>
        {footer ? (
          <div
            data-testid="fui-card-footer"
            className="border-t border-dashed border-[var(--fui-line)] px-4 py-2 text-[10px] tracking-[0.08em] text-[var(--fui-text-dim)]"
          >
            {footer}
          </div>
        ) : null}
      </div>
    )
  },
)

Card.displayName = 'Card'
