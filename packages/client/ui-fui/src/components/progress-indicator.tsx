import { forwardRef, Fragment } from 'react'
import { cn } from '../lib/cn.ts'

export interface ProgressIndicatorProps {
  /** 步骤标签 */
  steps: string[]
  /** 0 基当前步骤索引(越界时 clamp 到 [0, steps.length - 1]) */
  current: number
  className?: string
}

type StepState = 'complete' | 'current' | 'pending'

/**
 * FUI 风格多步骤进度指示(wizard 步骤条):方角小方块 + 小字号标签,
 * 步骤之间以 1px 钢蓝线段连接,三态区分:
 * 已完成方块实心青绿 + 极弱辉光;当前为青绿 1px 描边空心 + primary 标签,
 * li 带 aria-current="step";未开始为淡钢蓝描边 + 淡钢蓝底 + dim 标签。
 */
export const ProgressIndicator = forwardRef<
  HTMLOListElement,
  ProgressIndicatorProps
>(({ steps, current, className }, ref) => {
  if (steps.length === 0) return null

  const clamped = Math.min(Math.max(current, 0), steps.length - 1)

  return (
    <ol ref={ref} className={cn('flex items-center gap-2', className)}>
      {steps.map((label, index) => {
        const state: StepState =
          index < clamped
            ? 'complete'
            : index === clamped
              ? 'current'
              : 'pending'
        return (
          <Fragment key={index}>
            <li
              className="flex items-center gap-2"
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span
                data-testid={`progress-dot-${index}`}
                data-state={state}
                className={cn(
                  'h-2.5 w-2.5',
                  state === 'current' &&
                    'border border-[var(--fui-primary)] bg-transparent',
                  state === 'pending' &&
                    'border border-[var(--fui-line-soft)] bg-[var(--fui-line-faint)]',
                )}
                style={
                  state === 'complete'
                    ? {
                      background: 'var(--fui-primary)',
                      boxShadow: 'var(--fui-glow-sm)',
                    }
                    : undefined
                }
              />
              <span
                className={cn(
                  'text-[10px] uppercase leading-none tracking-[0.2em]',
                  state === 'complete' && 'text-[var(--fui-text)]',
                  state === 'current' && 'text-[var(--fui-primary)]',
                  state === 'pending' && 'text-[var(--fui-text-dim)]',
                )}
              >
                {label}
              </span>
            </li>
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="h-px flex-1"
                style={{ background: 'var(--fui-line-soft)' }}
              />
            )}
          </Fragment>
        )
      })}
    </ol>
  )
})

ProgressIndicator.displayName = 'ProgressIndicator'
