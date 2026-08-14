import { forwardRef } from 'react'
import { cn } from '../lib/cn.ts'

export type BarChartTone = 'primary' | 'warn' | 'accent'

export interface BarChartDatum {
  label: string
  value: number
}

export interface BarChartProps {
  data: BarChartDatum[]
  /** 刻度最大值,默认取 data 最大值(全 0 时按 1 防除零) */
  max?: number
  /** 柱体色,默认 primary */
  tone?: BarChartTone
  /** 图表区高度(px),默认 96 */
  height?: number
  /** 柱顶显示数值 */
  showValues?: boolean
  className?: string
}

/**
 * FUI 风格柱状图:方角实心柱(60% 透明度同色)、极淡 1px 基线、
 * 9px 大写 dim 标签,无辉光无渐变。纯展示,无交互。
 */
export const BarChart = forwardRef<HTMLDivElement, BarChartProps>(
  (
    { data, max, tone = 'primary', height = 96, showValues = false, className },
    ref,
  ) => {
    const maxValue = max ?? Math.max(1, ...data.map(d => d.value))

    return (
      <div
        ref={ref}
        role="img"
        aria-label="BAR CHART"
        data-tone={tone}
        className={cn('w-full', className)}
      >
        <div className="flex items-end" style={{ height }}>
          {data.map(d => (
            <div
              key={d.label}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
            >
              {showValues ? (
                <span
                  className="text-[9px] leading-none"
                  style={{ color: `var(--fui-${tone})` }}
                >
                  {d.value}
                </span>
              ) : null}
              <div
                data-testid="fui-bar-chart-bar"
                className="w-3/5 opacity-60"
                style={{
                  height: `${(d.value / maxValue) * 100}%`,
                  background: `var(--fui-${tone})`,
                }}
              />
              <span className="text-[9px] tracking-[0.15em] uppercase text-[var(--fui-text-dim)]">
                {d.label}
              </span>
            </div>
          ))}
        </div>
        {/* 1px 基线 */}
        <div
          data-testid="fui-bar-chart-baseline"
          className="border-t border-[var(--fui-line)]"
        />
      </div>
    )
  },
)

BarChart.displayName = 'BarChart'
