import { forwardRef, type LabelHTMLAttributes } from 'react'
import { cn } from '../lib/cn.ts'

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** 必填标记:末尾追加红色星号(aria-hidden) */
  required?: boolean
}

/**
 * FUI 风格表单标签:小字大写 dim 色。
 * required 时末尾追加 danger 色星号(aria-hidden,避免读屏重复播报)。
 */
export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ required, className, children, ...rest }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          'text-[10px] uppercase leading-none tracking-[0.2em] text-[var(--fui-text-dim)]',
          className,
        )}
        {...rest}
      >
        {children}
        {required ? (
          <span aria-hidden="true" className="text-[var(--fui-danger)]">
            {' *'}
          </span>
        ) : null}
      </label>
    )
  },
)

Label.displayName = 'Label'
