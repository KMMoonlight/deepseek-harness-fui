import { forwardRef, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export interface BreadcrumbsItem {
  label: string
  /** 传 href 渲染为链接;仅传 onClick 渲染为按钮;都不传渲染为纯文本 */
  href?: string
  onClick?: () => void
}

export interface BreadcrumbsProps {
  items: BreadcrumbsItem[]
  /** 分隔符,默认 › */
  separator?: ReactNode
  className?: string
}

/**
 * FUI 风格面包屑:10px 大写宽字距小字,› 分隔。
 * 末项为当前页(primary 青绿纯文本,aria-current="page"),
 * 其余为 dim 字链接/按钮,hover 提亮。无辉光、无下划线。
 */
export const Breadcrumbs = forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ items, separator = '›', className }, ref) => {
    return (
      <nav ref={ref} aria-label="breadcrumb" className={cn(className)}>
        <ol className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em]">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            return (
              <li key={index} className="flex items-center gap-2">
                {index > 0 ? (
                  <span
                    aria-hidden
                    className="select-none text-[var(--fui-text-dim)]"
                  >
                    {separator}
                  </span>
                ) : null}
                {isLast ? (
                  <span
                    aria-current="page"
                    className="text-[var(--fui-primary)]"
                  >
                    {item.label}
                  </span>
                ) : item.href !== undefined ? (
                  <a
                    href={item.href}
                    onClick={item.onClick}
                    className={cn(
                      'text-[var(--fui-text-dim)]',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'hover:text-[var(--fui-text)]',
                    )}
                  >
                    {item.label}
                  </a>
                ) : item.onClick ? (
                  <button
                    type="button"
                    onClick={item.onClick}
                    className={cn(
                      'cursor-pointer uppercase tracking-[0.2em] text-[var(--fui-text-dim)]',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'hover:text-[var(--fui-text)]',
                    )}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="text-[var(--fui-text-dim)]">
                    {item.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
    )
  },
)

Breadcrumbs.displayName = 'Breadcrumbs'
