import { forwardRef, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '../lib/cn.ts'

export interface RadioItem {
  value: string
  label: string
  disabled?: boolean
}

export interface RadioProps {
  items: RadioItem[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

/**
 * FUI 风格方形单选组:方角指示框,选中时内部渲染 4px 实心青绿方块
 * (极弱辉光)。未选中 dim 字,hover 指示框描边提亮、字转正色;
 * 选中项标签转正色。disabled 项半透明不可选。
 * 支持受控/非受控;roving tabindex,方向键/Home/End 移动并选中,跳过 disabled。
 */
export const Radio = forwardRef<HTMLDivElement, RadioProps>(
  ({ items, value, defaultValue, onValueChange, className }, ref) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState<string | undefined>(
      defaultValue,
    )
    const current = isControlled ? value : innerValue
    const radioRefs = useRef<(HTMLButtonElement | null)[]>([])

    // 无选中项时,把 tab 焦点落在第一个可选(非 disabled)项上
    const firstEnabledIndex = items.findIndex(item => !item.disabled)

    const select = (nextValue: string, focusIndex?: number) => {
      if (!isControlled) setInnerValue(nextValue)
      onValueChange?.(nextValue)
      if (focusIndex !== undefined) radioRefs.current[focusIndex]?.focus()
    }

    // 从当前选中项出发,沿 dir 方向找下一个可选下标(回绕)
    const findEnabledIndex = (dir: 1 | -1): number | null => {
      if (items.length === 0) return null
      let index = items.findIndex(item => item.value === current)
      for (let step = 0; step < items.length; step++) {
        index = (index + dir + items.length) % items.length
        if (!items[index]?.disabled) return index
      }
      return null
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      let nextIndex: number | null = null
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        nextIndex = findEnabledIndex(1)
      } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        nextIndex = findEnabledIndex(-1)
      } else if (event.key === 'Home') {
        nextIndex = firstEnabledIndex === -1 ? null : firstEnabledIndex
      } else if (event.key === 'End') {
        for (let i = items.length - 1; i >= 0; i--) {
          if (!items[i]?.disabled) {
            nextIndex = i
            break
          }
        }
      }
      if (nextIndex === null) return
      event.preventDefault()
      const next = items[nextIndex]
      if (next) select(next.value, nextIndex)
    }

    return (
      <div
        ref={ref}
        role="radiogroup"
        onKeyDown={onKeyDown}
        className={cn('flex flex-col gap-2', className)}
      >
        {items.map((item, index) => {
          const selected = item.value === current
          return (
            <button
              key={item.value}
              ref={(el) => {
                radioRefs.current[index] = el
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={item.disabled}
              tabIndex={
                selected ||
                (current === undefined && index === firstEnabledIndex)
                  ? 0
                  : -1
              }
              onClick={() => select(item.value)}
              className={cn(
                'group flex cursor-pointer items-center gap-2 text-left',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'flex h-3.5 w-3.5 items-center justify-center border border-[var(--fui-line)]',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  !item.disabled &&
                    'group-hover:border-[var(--fui-line-strong)]',
                )}
              >
                {selected ? (
                  <span
                    className="h-1 w-1"
                    style={{
                      backgroundColor: 'var(--fui-primary)',
                      boxShadow: 'var(--fui-glow-sm)',
                    }}
                  />
                ) : null}
              </span>
              <span
                className={cn(
                  'text-[10px] uppercase leading-none tracking-[0.2em]',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  selected
                    ? 'text-[var(--fui-text)]'
                    : 'text-[var(--fui-text-dim)]',
                  !selected &&
                    !item.disabled &&
                    'group-hover:text-[var(--fui-text)]',
                )}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    )
  },
)

Radio.displayName = 'Radio'
