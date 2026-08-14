import { forwardRef, useState } from 'react'
import { cn } from '../lib/cn.ts'

export interface SwitchProps {
  /** 受控开关状态 */
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
 * FUI 风格开关:方角轨道(h-4 w-8,1px 薄描边)+ 方形滑块。
 * ON:滑块平移右侧、实心青绿,轨道描边加亮 + 8% 青绿底;
 * OFF:滑块次要色,轨道面板底色。无辉光,过渡只动 transform。
 */
export const Switch = forwardRef<HTMLButtonElement, SwitchProps>(
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
        role="switch"
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
            'relative h-4 w-8 border transition-colors duration-150 motion-reduce:transition-none',
            on
              ? 'border-[var(--fui-line-strong)] bg-[var(--fui-primary-soft)]'
              : 'border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
          )}
        >
          <span
            className={cn(
              'absolute top-1/2 left-[2px] h-2.5 w-2.5 -translate-y-1/2',
              'transition-transform duration-150 motion-reduce:transition-none',
              on
                ? 'translate-x-[16px] bg-[var(--fui-primary)]'
                : 'bg-[var(--fui-text-dim)]',
            )}
          />
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

Switch.displayName = 'Switch'
