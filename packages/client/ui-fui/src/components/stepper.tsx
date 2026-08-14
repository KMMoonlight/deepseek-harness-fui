import { forwardRef, useState } from 'react'
import { cn } from '../lib/cn.ts'

export interface StepperProps {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  className?: string
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

/**
 * FUI 风格数字步进器:三段紧贴共框(减 / 数值 / 加),方角 1px 薄描边。
 * 内部按 step 增减并 clamp 到 [min, max];到达边界时对应按钮禁用,
 * 整体 disabled 时全部禁用且容器降透明度。
 */
export const Stepper = forwardRef<HTMLDivElement, StepperProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      min = 0,
      max = 99,
      step = 1,
      disabled = false,
      className,
    },
    ref,
  ) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState<number>(() =>
      clamp(defaultValue ?? min, min, max),
    )
    const current = clamp(isControlled ? value : innerValue, min, max)

    const update = (next: number) => {
      const clamped = clamp(next, min, max)
      if (!isControlled) setInnerValue(clamped)
      onValueChange?.(clamped)
    }

    const atMin = current <= min
    const atMax = current >= max

    const buttonClass = cn(
      'inline-flex h-7 w-7 cursor-pointer items-center justify-center text-xs leading-none text-[var(--fui-text-dim)]',
      'transition-colors duration-150 motion-reduce:transition-none',
      'hover:bg-[var(--fui-primary-soft)] hover:text-[var(--fui-text)]',
      'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[var(--fui-text-dim)]',
    )

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex border border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
          disabled && 'opacity-40',
          className,
        )}
      >
        <button
          type="button"
          aria-label="减少"
          disabled={disabled || atMin}
          onClick={() => update(current - step)}
          className={buttonClass}
        >
          −
        </button>
        <span
          aria-live="polite"
          className="inline-flex h-7 min-w-10 items-center justify-center border-x border-[var(--fui-line)] text-center text-xs leading-none tabular-nums text-[var(--fui-text)]"
        >
          {current}
        </span>
        <button
          type="button"
          aria-label="增加"
          disabled={disabled || atMax}
          onClick={() => update(current + step)}
          className={buttonClass}
        >
          +
        </button>
      </div>
    )
  },
)

Stepper.displayName = 'Stepper'
