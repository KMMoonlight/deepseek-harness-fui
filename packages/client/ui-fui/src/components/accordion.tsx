import {
  forwardRef,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface AccordionItem {
  value: string
  /** 标题,渲染为大写宽字距的小字 */
  title: string
  content: ReactNode
  disabled?: boolean
}

export interface AccordionProps {
  items: AccordionItem[]
  /** 受控:当前展开项的 value;undefined 表示全部收起 */
  value?: string
  /** 非受控初始展开项 */
  defaultValue?: string
  /** 展开项变化回调;再次点击已展开项收起时为 undefined */
  onValueChange?: (value: string | undefined) => void
  className?: string
}

/**
 * FUI 风格折叠面板:方角薄边单项面板,同一时刻只展开一项。
 * 标题行 dim 字 + 右侧 ▾;展开时标题转 primary 青绿并加 ◆ 节点,
 * 内容与标题间 1px dashed 分隔线。无展开动画(瞬时切换)。
 * 键盘:方向键/Home/End 在标题间移动焦点(跳过禁用项),Enter/Space 切换展开。
 */
export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  ({ items, value, defaultValue, onValueChange, className }, ref) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState<string | undefined>(
      defaultValue,
    )
    const current = isControlled ? value : innerValue
    const headerRefs = useRef<(HTMLButtonElement | null)[]>([])

    const toggle = (itemValue: string) => {
      const next = current === itemValue ? undefined : itemValue
      if (!isControlled) setInnerValue(next)
      onValueChange?.(next)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      const enabled = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => !item.disabled)
      if (enabled.length === 0) return
      const focusedIndex = headerRefs.current.findIndex(
        el => el === document.activeElement,
      )
      const enabledPos = enabled.findIndex(
        ({ index }) => index === focusedIndex,
      )
      let nextPos: number | null = null
      if (event.key === 'ArrowDown') {
        nextPos = enabledPos < 0 ? 0 : (enabledPos + 1) % enabled.length
      } else if (event.key === 'ArrowUp') {
        nextPos =
          enabledPos < 0
            ? enabled.length - 1
            : (enabledPos - 1 + enabled.length) % enabled.length
      } else if (event.key === 'Home') {
        nextPos = 0
      } else if (event.key === 'End') {
        nextPos = enabled.length - 1
      }
      if (nextPos === null) return
      event.preventDefault()
      const target = enabled[nextPos]
      if (target) headerRefs.current[target.index]?.focus()
    }

    return (
      <div
        ref={ref}
        onKeyDown={onKeyDown}
        className={cn('flex flex-col gap-1', className)}
      >
        {items.map((item, index) => {
          const open = item.value === current
          const headerId = `fui-accordion-header-${item.value}`
          const panelId = `fui-accordion-panel-${item.value}`
          return (
            <div
              key={item.value}
              data-testid="fui-accordion-item"
              data-open={open || undefined}
              className={cn(
                'border bg-[var(--fui-panel-bg)]',
                'transition-colors duration-150 motion-reduce:transition-none',
                open
                  ? 'border-[var(--fui-line-strong)]'
                  : 'border-[var(--fui-line)]',
                !open && 'hover:border-[var(--fui-line-strong)]',
              )}
            >
              <button
                ref={(el) => {
                  headerRefs.current[index] = el
                }}
                type="button"
                id={headerId}
                disabled={item.disabled}
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => toggle(item.value)}
                className={cn(
                  'flex h-9 w-full cursor-pointer items-center justify-between gap-2 px-3 text-[10px] uppercase leading-none tracking-[0.2em]',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  'disabled:cursor-not-allowed disabled:opacity-40',
                  open
                    ? 'text-[var(--fui-primary)]'
                    : 'text-[var(--fui-text-dim)] hover:text-[var(--fui-text)]',
                )}
              >
                <span className="flex items-center gap-1.5">
                  {open ? <span aria-hidden>◆</span> : null}
                  {item.title}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'transition-transform duration-150 motion-reduce:transition-none',
                    open ? 'rotate-180' : '',
                  )}
                >
                  ▾
                </span>
              </button>
              {open ? (
                <div
                  role="region"
                  id={panelId}
                  aria-labelledby={headerId}
                  className="border-t border-dashed border-[var(--fui-line)] px-3 py-3 text-xs text-[var(--fui-text)]"
                >
                  {item.content}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  },
)

Accordion.displayName = 'Accordion'
