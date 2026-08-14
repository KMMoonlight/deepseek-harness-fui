import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '../lib/cn.ts'

export type ButtonVariant = 'primary' | 'accent' | 'warn' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

/**
 * FUI 风格:方角矩形 + 1px 薄描边,无辉光。
 * primary 为反色实心(青绿底 + 深色字),对应参考图的选中 Tab;
 * 其余 variant 为描边 + 面板底色,hover 描边加亮、背景加 8% 同色。
 */
const variantClass: Record<ButtonVariant, string> = {
  primary:
    'border-[var(--fui-primary)] bg-[var(--fui-primary)] text-[var(--fui-bg)] hover:brightness-110',
  accent:
    'border-[var(--fui-accent-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-accent)] hover:border-[var(--fui-accent-line-strong)] hover:bg-[var(--fui-accent-soft)]',
  warn: 'border-[var(--fui-warn-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-warn)] hover:border-[var(--fui-warn-line-strong)] hover:bg-[var(--fui-warn-soft)]',
  ghost:
    'border-[var(--fui-neutral-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-text-dim)] hover:border-[var(--fui-neutral-line-strong)] hover:bg-[var(--fui-neutral-soft)] hover:text-[var(--fui-text)]',
}

const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-[10px]',
  md: 'h-9 px-4 text-xs',
  lg: 'h-11 px-6 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        data-variant={variant}
        data-size={size}
        className={cn(
          'inline-flex cursor-pointer items-center justify-center gap-2 border uppercase leading-none tracking-[0.2em]',
          'transition-colors duration-150 motion-reduce:transition-none',
          'active:translate-y-px motion-reduce:active:translate-y-0',
          'disabled:cursor-not-allowed disabled:opacity-40',
          variantClass[variant],
          sizeClass[size],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
