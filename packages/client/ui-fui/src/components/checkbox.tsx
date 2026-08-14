import { forwardRef, useState } from 'react'
import { cn } from '../lib/cn.ts'

export interface CheckboxProps {
  /** 受控勾选状态 */
  checked?: boolean
  /** 非受控初始状态 */
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  /** 右侧小字标签,点击同样切换 */
  label?: string
  className?: string
}

/**
 * FUI 风格复选框:12px 方角小格 + 1px 薄描边。
 * 勾选时青绿实心填充 + 深色 ✓,未勾选为面板底色,无辉光。
 */
export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  (
    {
      checked,
      defaultChecked = false,
      onCheckedChange,
      disabled,
      label,
      className,
    },
    ref,
  ) => {
    const [inner, setInner] = useState(defaultChecked)
    const isControlled = checked !== undefined
    const on = isControlled ? checked : inner

    const toggle = () => {
      if (disabled) return
      if (!isControlled) setInner(!on)
      onCheckedChange?.(!on)
    }

    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={on}
        disabled={disabled}
        onClick={toggle}
        className={cn(
          'inline-flex cursor-pointer items-center gap-2',
          'disabled:cursor-not-allowed disabled:opacity-40',
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex h-3 w-3 items-center justify-center border transition-colors duration-150 motion-reduce:transition-none',
            on
              ? 'border-[var(--fui-primary)] bg-[var(--fui-primary)]'
              : 'border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
          )}
        >
          {/* ✓ 始终渲染,只用透明度切换:勾选/取消时 flex 容器基线不变,
              避免按钮在行内排版中上下跳动 */}
          <svg
            viewBox="0 0 12 12"
            className={cn(
              'h-2.5 w-2.5 transition-opacity duration-150 motion-reduce:transition-none',
              on ? 'opacity-100' : 'opacity-0',
            )}
            fill="none"
            stroke="var(--fui-bg)"
            strokeWidth={2}
          >
            <path d="M2.5 6.5 L5 9 L9.5 3.5" />
          </svg>
        </span>
        {label ? (
          <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--fui-text-dim)]">
            {label}
          </span>
        ) : null}
      </button>
    )
  },
)

Checkbox.displayName = 'Checkbox'
