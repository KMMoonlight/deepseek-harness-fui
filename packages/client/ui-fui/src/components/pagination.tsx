import { forwardRef } from 'react'
import { cn } from '../lib/cn.ts'

export type PageItem = number | 'ellipsis'

/**
 * 计算页码窗口:始终显示首页和末页,当前页两侧各 siblingCount 页,
 * 缺口用 'ellipsis' 占位。total <= 0 时返回 null。
 */
// eslint-disable-next-line react-refresh/only-export-components -- 组件单文件分发约定:纯函数 helper 与组件同文件导出,供测试与使用方复用
export function getPageItems(
  page: number,
  total: number,
  siblingCount: number,
): PageItem[] | null {
  if (total <= 0) return null

  // 首尾 + 当前页及两侧兄弟 + 两个省略号,放得下就不需要省略号
  const totalShown = 2 * siblingCount + 5
  if (total <= totalShown) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const leftSibling = Math.max(page - siblingCount, 1)
  const rightSibling = Math.min(page + siblingCount, total)
  const showLeftEllipsis = leftSibling > 2
  const showRightEllipsis = rightSibling < total - 1

  if (!showLeftEllipsis && showRightEllipsis) {
    // 靠近首页:左侧连续,右侧省略
    const leftCount = 3 + 2 * siblingCount
    const items: PageItem[] = Array.from(
      { length: leftCount },
      (_, i) => i + 1,
    )
    items.push('ellipsis', total)
    return items
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    // 靠近末页:左侧省略,右侧连续
    const rightCount = 3 + 2 * siblingCount
    const start = total - rightCount + 1
    const items: PageItem[] = [1, 'ellipsis']
    for (let p = start; p <= total; p++) items.push(p)
    return items
  }

  // 居中:两侧都省略
  const items: PageItem[] = [1, 'ellipsis']
  for (let p = leftSibling; p <= rightSibling; p++) items.push(p)
  items.push('ellipsis', total)
  return items
}

export interface PaginationProps {
  /** 当前页,1 基(纯受控) */
  page: number
  /** 总页数 */
  total: number
  /** 页码变化回调;组件不自己改页码 */
  onPageChange?: (page: number) => void
  /** 当前页两侧各显示的页码数,默认 1 */
  siblingCount?: number
  className?: string
}

/**
 * FUI 风格页码导航:方角薄边小方块按钮,纯受控。
 * 当前页反色实心(青绿底 + 深色字,无辉光)+ aria-current="page";
 * 其余页描边 + 面板底色 + dim 字,hover 描边加亮。
 * ‹ › 在首页/末页禁用;缺口渲染为 dim 色 … 文本(非按钮)。
 */
export const Pagination = forwardRef<HTMLElement, PaginationProps>(
  ({ page, total, onPageChange, siblingCount = 1, className }, ref) => {
    const items = getPageItems(page, total, siblingCount)
    if (items === null) return null

    const buttonClass =
      'inline-flex h-7 min-w-7 cursor-pointer items-center justify-center border px-1 text-[10px] leading-none transition-colors duration-150 motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40'
    const idleClass =
      'border-[var(--fui-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-text-dim)] hover:border-[var(--fui-line-strong)] hover:text-[var(--fui-text)]'

    return (
      <nav
        ref={ref}
        aria-label="pagination"
        className={cn('flex items-center gap-1', className)}
      >
        <button
          type="button"
          aria-label="上一页"
          disabled={page <= 1}
          onClick={() => onPageChange?.(page - 1)}
          className={cn(buttonClass, idleClass)}
        >
          ‹
        </button>
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden
              className="inline-flex h-7 min-w-7 items-center justify-center px-1 text-[10px] leading-none text-[var(--fui-text-dim)]"
            >
              …
            </span>
          ) : (
            // 按槽位(index)作 key:窗口滑动时原位更新数字,
            // 不销毁/重建按钮,避免中间页码闪动
            <button
              key={index}
              type="button"
              aria-current={item === page ? 'page' : undefined}
              onClick={() => onPageChange?.(item)}
              className={cn(
                buttonClass,
                item === page
                  ? 'border-[var(--fui-primary)] bg-[var(--fui-primary)] text-[var(--fui-bg)]'
                  : idleClass,
              )}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          aria-label="下一页"
          disabled={page >= total}
          onClick={() => onPageChange?.(page + 1)}
          className={cn(buttonClass, idleClass)}
        >
          ›
        </button>
      </nav>
    )
  },
)

Pagination.displayName = 'Pagination'
