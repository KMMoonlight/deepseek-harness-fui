import {
  forwardRef,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface DropdownMenuItem {
  value: string
  label: string
  /** 危险操作:红色文字,hover 8% 红色填充 */
  danger?: boolean
  disabled?: boolean
}

export interface DropdownMenuProps {
  /** 触发按钮内容(通常为文字,如 SHIP OPS) */
  trigger: ReactNode
  items: DropdownMenuItem[]
  onSelect?: (value: string) => void
  disabled?: boolean
  className?: string
}

function assignRef(
  ref: Ref<HTMLDivElement> | undefined,
  el: HTMLDivElement | null,
) {
  if (typeof ref === 'function') ref(el)
  // React 18 types mark RefObject.current readonly; assignment is the intent here.
  else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = el
}

/**
 * FUI 风格下拉菜单(动作菜单,非表单选择):触发器方角薄边 + 右侧 ▾;
 * 菜单 1px 描边 + 面板底色,hover 8% 青绿填充,danger 项红色。
 * Escape 关闭并焦点回触发器,上下方向键移动高亮(跳过禁用项),
 * Enter 触发,点击组件外关闭。
 */
export const DropdownMenu = forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ trigger, items, onSelect, disabled, className }, ref) => {
    const [open, setOpen] = useState(false)
    const [highlight, setHighlight] = useState(-1)
    const rootRef = useRef<HTMLDivElement | null>(null)
    const triggerRef = useRef<HTMLButtonElement | null>(null)

    useEffect(() => {
      if (!open) return
      const onMouseDown = (event: MouseEvent) => {
        if (
          rootRef.current &&
          !rootRef.current.contains(event.target as Node)
        ) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', onMouseDown)
      return () => document.removeEventListener('mousedown', onMouseDown)
    }, [open])

    const close = (focusTrigger = false) => {
      setOpen(false)
      if (focusTrigger) triggerRef.current?.focus()
    }

    const select = (item: DropdownMenuItem) => {
      if (item.disabled) return
      onSelect?.(item.value)
      close()
    }

    const toggle = () => {
      if (disabled) return
      setOpen(prev => !prev)
      setHighlight(-1)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      if (event.key === 'Escape') {
        if (open) close(true)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const enabled = items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => !item.disabled)
        if (enabled.length === 0) return
        if (!open) {
          setOpen(true)
          setHighlight(enabled[0]?.index ?? -1)
          return
        }
        const dir = event.key === 'ArrowDown' ? 1 : -1
        const pos = enabled.findIndex(({ index }) => index === highlight)
        const nextPos =
          pos < 0
            ? dir === 1
              ? 0
              : enabled.length - 1
            : (pos + dir + enabled.length) % enabled.length
        setHighlight(enabled[nextPos]?.index ?? -1)
        return
      }
      if (event.key === 'Enter' && open) {
        event.preventDefault()
        const item = items[highlight]
        if (item) select(item)
      }
    }

    return (
      <div
        ref={(el) => {
          rootRef.current = el
          assignRef(ref, el)
        }}
        onKeyDown={onKeyDown}
        className={cn('relative inline-block', className)}
      >
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          className={cn(
            'inline-flex h-9 cursor-pointer items-center justify-center gap-2 border px-3 text-[10px] uppercase tracking-[0.2em]',
            'border-[var(--fui-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-text-dim)]',
            'transition-colors duration-150 motion-reduce:transition-none',
            'hover:border-[var(--fui-line-strong)] hover:text-[var(--fui-text)]',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <span className="flex items-center leading-none">{trigger}</span>
          <span aria-hidden className="leading-none">
            ▾
          </span>
        </button>
        {open ? (
          <ul
            role="menu"
            className="absolute left-0 top-full z-20 mt-1 min-w-full border border-[var(--fui-line)] bg-fui-panel-solid"
          >
            {items.map((item, index) => (
              <li
                key={item.value}
                role="menuitem"
                aria-disabled={item.disabled || undefined}
                data-highlighted={index === highlight || undefined}
                data-danger={item.danger || undefined}
                onClick={() => select(item)}
                onMouseEnter={() => {
                  if (!item.disabled) setHighlight(index)
                }}
                className={cn(
                  'flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]',
                  'transition-colors duration-150 motion-reduce:transition-none',
                  item.disabled && 'cursor-not-allowed opacity-40',
                  item.danger
                    ? 'text-[var(--fui-danger)] hover:bg-[var(--fui-danger-soft)]'
                    : 'text-[var(--fui-text)] hover:bg-[var(--fui-primary-soft)]',
                  !item.disabled &&
                    index === highlight &&
                    (item.danger
                      ? 'bg-[var(--fui-danger-soft)]'
                      : 'bg-[var(--fui-primary-soft)]'),
                )}
              >
                {item.label}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    )
  },
)

DropdownMenu.displayName = 'DropdownMenu'
