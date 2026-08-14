import { forwardRef, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../lib/cn.ts'

export interface SegmentedControlItem {
  value: string
  label: string
}

export interface SegmentedControlProps {
  items: SegmentedControlItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

/**
 * FUI 风格分段控制器:与 Tabs 的区别是所有段共用一个外框、
 * 段与段紧贴,中间用 1px 竖线(非首段左边框)分隔。
 * 选中段反色实心(青绿底 + 深色字,无辉光,左边框同步转 primary);
 * 未选中 dim 字,hover 提亮文字并加 8% 青绿底。
 * roving tabindex:选中段 tabIndex 0,其余 -1;方向键/Home/End 移动并选中。
 */
export const SegmentedControl = forwardRef<
  HTMLDivElement,
  SegmentedControlProps
>(({ items, value, defaultValue, onValueChange, className }, ref) => {
  const isControlled = value !== undefined
  const [innerValue, setInnerValue] = useState<string | undefined>(
    defaultValue ?? items[0]?.value,
  )
  const current = isControlled ? value : innerValue
  const segmentRefs = useRef<(HTMLButtonElement | null)[]>([])

  const select = (nextValue: string, focusIndex?: number) => {
    if (!isControlled) setInnerValue(nextValue)
    onValueChange?.(nextValue)
    if (focusIndex !== undefined) segmentRefs.current[focusIndex]?.focus()
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
      role="group"
      onKeyDown={onKeyDown}
      className={cn(
        'inline-flex border border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
        className,
      )}
    >
      {items.map((item, index) => {
        const selected = item.value === current
        return (
          <button
            key={item.value}
            ref={(el) => {
              segmentRefs.current[index] = el
            }}
            type="button"
            aria-pressed={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => select(item.value)}
            className={cn(
              'inline-flex h-7 cursor-pointer items-center justify-center px-3 text-[10px] uppercase leading-none tracking-[0.2em]',
              index > 0 && 'border-l',
              'transition-colors duration-150 motion-reduce:transition-none',
              selected
                ? 'border-[var(--fui-primary)] bg-[var(--fui-primary)] text-[var(--fui-bg)]'
                : 'border-[var(--fui-line)] text-[var(--fui-text-dim)] hover:bg-[var(--fui-primary-soft)] hover:text-[var(--fui-text)]',
            )}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
})

SegmentedControl.displayName = 'SegmentedControl'
