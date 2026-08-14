import { forwardRef, type CSSProperties } from 'react'
import { cn } from '../lib/cn.ts'

export type ProgressBarTone = 'primary' | 'warn' | 'accent'

export interface ProgressBarProps {
  /** 0-100,内部 clamp */
  value: number
  /** 分段方块数,默认 10(仅 bar 模式) */
  segments?: number
  /** bar = 分段方块(默认);ring = 圆环 */
  mode?: 'bar' | 'ring'
  /** ring 模式的 svg 尺寸(px),默认 56 */
  ringSize?: number
  /** 左侧标签(如 HULL);ring 模式下显示在圆环右侧上方 */
  label?: string
  /** 右侧读数(如 50/50);ring 模式下显示在 label 下方 */
  valueText?: string
  /** 填充色,默认 primary(青绿);需要告警语义时显式传 warn / accent */
  tone?: ProgressBarTone
  className?: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const toneGlow: Record<ProgressBarTone, string> = {
  primary: 'var(--fui-glow-sm)',
  warn: 'var(--fui-glow-sm-warn)',
  accent: 'var(--fui-glow-sm-accent)',
}

/**
 * FUI 风格进度显示,两种形态:
 * bar 渲染一格一格的独立方块(已填充实心 + 极弱同色辉光,未填充淡钢蓝描边),
 * 不做平滑填充;ring 是圆环,半径取 15.9155 让周长约等于 100,
 * strokeDasharray 直接按百分比取段。
 * 左侧可挂标签、右侧可挂读数,tone 决定填充色。
 */
export const ProgressBar = forwardRef<HTMLDivElement, ProgressBarProps>(
  (
    {
      value,
      segments = 10,
      mode = 'bar',
      ringSize = 56,
      label,
      valueText,
      tone = 'primary',
      className,
    },
    ref,
  ) => {
    const clamped = clamp(Math.round(value), 0, 100)

    if (mode === 'ring') {
      // r = 15.9155 使周长 ≈ 100,strokeDasharray 直接按百分比取段
      return (
        <div
          ref={ref}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
          className={cn('flex items-center gap-3', className)}
        >
          <div
            className="relative shrink-0"
            style={{ width: ringSize, height: ringSize }}
          >
            <svg width={ringSize} height={ringSize} viewBox="0 0 36 36">
              <circle
                cx={18}
                cy={18}
                r={15.9155}
                fill="none"
                stroke="var(--fui-line-soft)"
                strokeWidth={3}
              />
              <circle
                data-testid="fui-progress-ring"
                cx={18}
                cy={18}
                r={15.9155}
                fill="none"
                stroke={`var(--fui-${tone})`}
                strokeWidth={3}
                strokeDasharray={`${clamped} 100`}
                strokeLinecap="butt"
                transform="rotate(-90 18 18)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] text-[var(--fui-text-dim)]">
              {clamped}%
            </span>
          </div>
          {label || valueText ? (
            <div className="flex flex-col gap-0.5">
              {label ? (
                <span className="text-[10px] tracking-[0.2em] uppercase text-[var(--fui-text-dim)]">
                  {label}
                </span>
              ) : null}
              {valueText ? (
                <span className="text-[10px] tracking-[0.12em] text-[var(--fui-text-dim)]">
                  {valueText}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      )
    }

    const filled = clamp(Math.round((clamped / 100) * segments), 0, segments)

    const filledStyle: CSSProperties = {
      background: `var(--fui-${tone})`,
      boxShadow: toneGlow[tone],
    }
    const emptyStyle: CSSProperties = {
      background: 'var(--fui-line-faint)',
      border: '1px solid var(--fui-line-soft)',
    }

    return (
      <div ref={ref} className={cn('flex items-center gap-3', className)}>
        {label ? (
          <span className="shrink-0 text-[10px] tracking-[0.2em] uppercase text-[var(--fui-text-dim)]">
            {label}
          </span>
        ) : null}
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clamped}
          className="flex h-3 items-stretch gap-[3px]"
        >
          {Array.from({ length: segments }, (_, i) =>
            i < filled ? (
              <span
                key={i}
                data-testid="fui-progress-block"
                className="h-full w-1.5"
                style={filledStyle}
              />
            ) : (
              <span
                key={i}
                aria-hidden
                className="h-full w-1.5"
                style={emptyStyle}
              />
            ),
          )}
        </div>
        {valueText ? (
          <span className="ml-auto text-[10px] tracking-[0.12em] text-[var(--fui-text-dim)]">
            {valueText}
          </span>
        ) : null}
      </div>
    )
  },
)

ProgressBar.displayName = 'ProgressBar'
