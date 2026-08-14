import { forwardRef, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export interface EmptyStateProps {
  /** 标题,大写宽字距 */
  title: string
  /** 补充说明,dim 小字 */
  description?: string
  /** 图标/示意(如 SVG 或字符符号),渲染为 dim 色 */
  icon?: ReactNode
  /** 操作区(通常为 Button,由使用方组合传入) */
  action?: ReactNode
  className?: string
}

/**
 * FUI 风格空状态:方角虚线框内居中排布,克制无辉光。
 * icon → title → description → action 自上而下,仅 title 必填。
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ title, description, icon, action, className }, ref) => {
    return (
      <div
        ref={ref}
        data-testid="fui-empty-state"
        className={cn(
          'flex flex-col items-center justify-center gap-2 border border-dashed border-[var(--fui-line)] bg-[var(--fui-panel-bg)] px-8 py-10 text-center',
          className,
        )}
      >
        {icon ? (
          <div className="mb-1 flex text-[var(--fui-text-dim)]">{icon}</div>
        ) : null}
        <div className="text-xs uppercase tracking-[0.25em] text-[var(--fui-text)]">
          {title}
        </div>
        {description ? (
          <div className="max-w-sm text-[10px] leading-relaxed tracking-[0.12em] text-[var(--fui-text-dim)]">
            {description}
          </div>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
    )
  },
)

EmptyState.displayName = 'EmptyState'
