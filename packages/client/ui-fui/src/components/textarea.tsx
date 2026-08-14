import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn.ts'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** 上方标签,小字大写 dim 色,自动关联 textarea */
  label?: string
  /** true 仅描边告警色;字符串同时在下方渲染错误文本 */
  error?: boolean | string
}

/**
 * FUI 风格多行输入:与 Input 同一套样式(方角 + 1px 薄描边,
 * focus 描边加亮 + 极弱青绿辉光,青绿光标,error 品红描边),
 * 另加 resize-none,默认 4 行。
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, id, rows = 4, className, ...rest }, ref) => {
    const autoId = useId()
    const textareaId = id ?? autoId
    const errorText = typeof error === 'string' ? error : undefined

    return (
      <div className="flex flex-col gap-1">
        {label ? (
          <label
            htmlFor={textareaId}
            className="text-[10px] uppercase tracking-[0.2em] text-[var(--fui-text-dim)]"
          >
            {label}
          </label>
        ) : null}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          aria-invalid={error ? true : undefined}
          className={cn(
            'resize-none border bg-[var(--fui-panel-bg)] px-2 py-2 text-xs text-[var(--fui-text)]',
            'placeholder:text-[var(--fui-text-dim)] caret-[var(--fui-primary)]',
            'outline-none transition-colors duration-150 motion-reduce:transition-none',
            'disabled:cursor-not-allowed disabled:opacity-40',
            error
              ? 'border-[var(--fui-accent)] focus:border-[var(--fui-accent)]'
              : 'border-[var(--fui-line)] focus:border-[var(--fui-line-strong)] focus:shadow-[var(--fui-glow-sm)]',
            className,
          )}
          {...rest}
        />
        {errorText ? (
          <span className="text-[10px] tracking-[0.08em] text-[var(--fui-accent)]">
            {errorText}
          </span>
        ) : null}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
