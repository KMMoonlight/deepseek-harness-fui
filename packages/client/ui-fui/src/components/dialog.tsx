import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export interface DialogProps {
  /** false 时不渲染 */
  open: boolean
  onClose?: () => void
  /** 标题骑在顶边框上(与 Panel 同模式),渲染为 `TITLE ◆` */
  title?: string
  children?: ReactNode
  /** 底部按钮区:存在时上方加 1px dashed 分隔线,内容右对齐 */
  footer?: ReactNode
  /** 点击遮罩是否关闭,默认 true;点击对话框内部永远不关闭 */
  closeOnBackdrop?: boolean
  className?: string
}

/**
 * FUI 风格模态对话框:实色底方角面板 + 1px 钢蓝描边,无辉光;
 * 标题骑边框(TITLE ◆),右上角 ✕ dim 关闭按钮;
 * Escape / 遮罩点击关闭,进场 opacity + translateY(4px) 150ms
 *(reduced-motion 关闭过渡)。
 */
export const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      open,
      onClose,
      title,
      children,
      footer,
      closeOnBackdrop = true,
      className,
    },
    ref,
  ) => {
    const [entered, setEntered] = useState(false)
    const dialogRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
      if (!open) {
        setEntered(false)
        return
      }
      const id = window.setTimeout(() => setEntered(true), 20)
      return () => window.clearTimeout(id)
    }, [open])

    // Escape 关闭:open 变化时绑定/解绑
    useEffect(() => {
      if (!open || !onClose) return
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', onKeyDown)
      return () => window.removeEventListener('keydown', onKeyDown)
    }, [open, onClose])

    // 打开时焦点移入对话框容器
    useEffect(() => {
      if (open) dialogRef.current?.focus()
    }, [open])

    if (!open) return null

    return (
      /* 遮罩:点在这里(target === currentTarget)才触发关闭 */
      <div
        data-testid="fui-dialog-backdrop"
        onClick={(e) => {
          if (closeOnBackdrop && e.target === e.currentTarget) onClose?.()
        }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--fui-overlay)]"
      >
        <div
          ref={(node) => {
            dialogRef.current = node
            if (typeof ref === 'function') ref(node)
            else if (ref) ref.current = node
          }}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          className={cn(
            'relative w-96 max-w-[90vw] border border-[var(--fui-line)] bg-fui-panel-solid outline-none',
            'transition-all duration-150 motion-reduce:transition-none',
            entered ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
            className,
          )}
        >
          {title ? (
            /* 标题骑在顶边框上:实色底衬(与对话框底色同色)把边框线断开 */
            <div
              data-testid="fui-dialog-title"
              className="absolute left-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5 bg-fui-panel-solid px-1.5 text-[10px] tracking-[0.25em] uppercase text-[var(--fui-text)]"
            >
              {title}
              <span className="text-[var(--fui-primary)]">◆</span>
            </div>
          ) : null}
          <button
            type="button"
            aria-label="CLOSE"
            onClick={onClose}
            className={cn(
              'absolute right-2 top-2 inline-flex h-5 w-5 cursor-pointer items-center justify-center',
              'text-[var(--fui-text-dim)] hover:bg-[var(--fui-line-ghost)] hover:text-[var(--fui-text)]',
              'transition-colors duration-150 motion-reduce:transition-none',
            )}
          >
            ✕
          </button>
          <div className="p-4">{children}</div>
          {footer ? (
            <div className="flex justify-end gap-2 border-t border-dashed border-[var(--fui-line)] p-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    )
  },
)

Dialog.displayName = 'Dialog'
