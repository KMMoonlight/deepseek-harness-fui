import { forwardRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export interface ListItem {
  value: string
  label: ReactNode
  /** 右侧辅助信息,渲染为 dim 小号宽字距文本 */
  meta?: ReactNode
  disabled?: boolean
}

export interface ListProps {
  items: ListItem[]
  /** 是否可选择,默认 false(纯展示列表) */
  selectable?: boolean
  /** 受控:当前选中行的 value(仅 selectable) */
  value?: string
  /** 非受控初始选中行(仅 selectable) */
  defaultValue?: string
  /** 选中变化回调(仅 selectable) */
  onValueChange?: (value: string) => void
  className?: string
}

/**
 * FUI 风格数据列表:方角薄边面板,行间 1px dashed 分隔。
 * 默认纯展示(role="list");selectable 时可点选(role="listbox"):
 * hover 行加 8% 青绿底色,选中行 label 转 primary 青绿并加 ◆ 节点,
 * disabled 行半透明不可选。支持受控/非受控。
 */
export const List = forwardRef<HTMLDivElement, ListProps>(
  (
    {
      items,
      selectable = false,
      value,
      defaultValue,
      onValueChange,
      className,
    },
    ref,
  ) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState<string | undefined>(
      defaultValue,
    )
    const current = isControlled ? value : innerValue

    const select = (nextValue: string) => {
      if (!isControlled) setInnerValue(nextValue)
      onValueChange?.(nextValue)
    }

    const renderContent = (item: ListItem, selected: boolean) => (
      <>
        <span
          className={cn(
            'flex items-center gap-1.5 text-xs leading-none',
            selectable && selected
              ? 'text-[var(--fui-primary)]'
              : 'text-[var(--fui-text)]',
          )}
        >
          {selectable && selected ? <span aria-hidden>◆</span> : null}
          {item.label}
        </span>
        {item.meta !== undefined && item.meta !== null ? (
          <span className="text-[10px] leading-none tracking-[0.12em] text-[var(--fui-text-dim)]">
            {item.meta}
          </span>
        ) : null}
      </>
    )

    const rowClass = (index: number) =>
      cn(
        'flex w-full items-center justify-between gap-4 px-3 py-2 text-left',
        index > 0 && 'border-t border-dashed border-[var(--fui-line)]',
      )

    return (
      <div
        ref={ref}
        role={selectable ? 'listbox' : 'list'}
        className={cn(
          'flex flex-col border border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
          className,
        )}
      >
        {items.map((item, index) => {
          if (!selectable) {
            return (
              <div key={item.value} role="listitem" className={rowClass(index)}>
                {renderContent(item, false)}
              </div>
            )
          }
          const selected = item.value === current
          return (
            <button
              key={item.value}
              type="button"
              role="option"
              aria-selected={selected}
              disabled={item.disabled}
              onClick={() => select(item.value)}
              className={cn(
                rowClass(index),
                'cursor-pointer',
                'transition-colors duration-150 motion-reduce:transition-none',
                'hover:bg-[var(--fui-primary-soft)]',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              {renderContent(item, selected)}
            </button>
          )
        })}
      </div>
    )
  },
)

List.displayName = 'List'
