import { forwardRef, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../lib/cn.ts'

export interface TabsItem {
  value: string
  label: string
}

export interface TabsProps {
  items: TabsItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

/**
 * FUI 风格 Tab:方角薄边,选中反色实心(青绿底 + 深色字,无辉光),
 * 未选中 1px 钢蓝描边 + 面板底色 + dim 字,hover 描边加亮。
 * roving tabindex:选中项 tabIndex 0,其余 -1;方向键/Home/End 移动并选中。
 */
export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ items, value, defaultValue, onValueChange, className }, ref) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState<string | undefined>(
      defaultValue ?? items[0]?.value,
    )
    const current = isControlled ? value : innerValue
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

    const select = (nextValue: string, focusIndex?: number) => {
      if (!isControlled) setInnerValue(nextValue)
      onValueChange?.(nextValue)
      if (focusIndex !== undefined) tabRefs.current[focusIndex]?.focus()
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (items.length === 0) return
      const index = items.findIndex(item => item.value === current)
      let nextIndex: number | null = null
      if (event.key === 'ArrowRight') {
        nextIndex = (index + 1) % items.length
      } else if (event.key === 'ArrowLeft') {
        nextIndex = (index - 1 + items.length) % items.length
      } else if (event.key === 'Home') {
        nextIndex = 0
      } else if (event.key === 'End') {
        nextIndex = items.length - 1
      }
      if (nextIndex === null) return
      event.preventDefault()
      const next = items[nextIndex]
      if (next) select(next.value, nextIndex)
    }

    return (
      <div
        ref={ref}
        role="tablist"
        onKeyDown={onKeyDown}
        className={cn('flex gap-1', className)}
      >
        {items.map((item, index) => {
          const selected = item.value === current
          return (
            <button
              key={item.value}
              ref={(el) => {
                tabRefs.current[index] = el
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => select(item.value)}
              className={cn(
                'inline-flex h-7 cursor-pointer items-center justify-center border px-3 text-[10px] uppercase tracking-[0.2em]',
                'transition-colors duration-150 motion-reduce:transition-none',
                selected
                  ? 'border-[var(--fui-primary)] bg-[var(--fui-primary)] text-[var(--fui-bg)]'
                  : 'border-[var(--fui-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-text-dim)] hover:border-[var(--fui-line-strong)] hover:text-[var(--fui-text)]',
              )}
            >
              {item.label}
            </button>
          )
        })}
      </div>
    )
  },
)

Tabs.displayName = 'Tabs'
