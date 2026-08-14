import {
  forwardRef,
  type MutableRefObject,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  placeholder?: string
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
 * FUI 风格下拉选择:触发器方角薄边(同未选中 Tab),右侧 ▾;
 * 展开面板 1px 描边 + 面板底色,hover 8% 青绿填充,选中项青绿字 + ◆ 前缀。
 * Escape 关闭,上下方向键移动高亮,Enter 选定,点击组件外关闭。
 */
export const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      defaultValue,
      onValueChange,
      placeholder = 'SELECT…',
      disabled,
      className,
    },
    ref,
  ) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState<string | undefined>(
      defaultValue,
    )
    const current = isControlled ? value : innerValue
    const selected = options.find(option => option.value === current)
    const selectedIndex = options.findIndex(
      option => option.value === current,
    )

    const [open, setOpen] = useState(false)
    const [highlight, setHighlight] = useState(-1)
    const rootRef = useRef<HTMLDivElement | null>(null)

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

    const commit = (nextValue: string) => {
      if (!isControlled) setInnerValue(nextValue)
      onValueChange?.(nextValue)
      setOpen(false)
    }

    const toggle = () => {
      if (disabled) return
      setOpen(prev => !prev)
      setHighlight(selectedIndex)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled) return
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        if (options.length === 0) return
        if (!open) {
          setOpen(true)
          setHighlight(selectedIndex)
          return
        }
        const dir = event.key === 'ArrowDown' ? 1 : -1
        setHighlight(prev => (prev + dir + options.length) % options.length)
        return
      }
      if (event.key === 'Enter' && open) {
        event.preventDefault()
        const option = options[highlight]
        if (option) commit(option.value)
      }
    }

    return (
      <div
        ref={(el) => {
          rootRef.current = el
          assignRef(ref, el)
        }}
        className={cn('relative', className)}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={toggle}
          onKeyDown={onKeyDown}
          className={cn(
            'inline-flex h-9 w-full cursor-pointer items-center justify-between gap-2 border px-3 text-[10px] uppercase tracking-[0.2em]',
            'border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
            'transition-colors duration-150 motion-reduce:transition-none',
            'hover:border-[var(--fui-line-strong)]',
            'disabled:cursor-not-allowed disabled:opacity-40',
            selected ? 'text-[var(--fui-text)]' : 'text-[var(--fui-text-dim)]',
          )}
        >
          <span>{selected ? selected.label : placeholder}</span>
          <span aria-hidden className="leading-none text-[var(--fui-text-dim)]">
            ▾
          </span>
        </button>
        {open ? (
          <ul
            role="listbox"
            className="absolute left-0 top-full z-20 mt-1 w-full border border-[var(--fui-line)] bg-fui-panel-solid"
          >
            {options.map((option, index) => {
              const isSelected = option.value === current
              return (
                <li
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  data-highlighted={index === highlight || undefined}
                  onClick={() => commit(option.value)}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em]',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    'hover:bg-[var(--fui-primary-soft)]',
                    index === highlight ? 'bg-[var(--fui-primary-soft)]' : '',
                    isSelected
                      ? 'text-[var(--fui-primary)]'
                      : 'text-[var(--fui-text)]',
                  )}
                >
                  {isSelected ? <span aria-hidden>◆</span> : null}
                  {option.label}
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    )
  },
)

Select.displayName = 'Select'
