import { forwardRef } from 'react'
import { cn } from '../lib/cn.ts'

export type LineChartTone = 'primary' | 'warn' | 'accent'

export interface LineChartProps {
  data: number[]
  /** 折线与数据点色,默认 primary */
  tone?: LineChartTone
  /** 图表高度(px),默认 96 */
  height?: number
  /** 数据点渲染 2x2 小方块,默认 true */
  showDots?: boolean
  /** 每个数据点上方渲染数值,默认 false */
  showValues?: boolean
  /** 横向坐标轴标签(与数据点一一对应,均匀分布) */
  labels?: string[]
  className?: string
}

/** 3 条横向网格线,把高度四等分 */
const GRID_Y = [25, 50, 75]

/**
 * FUI 风格折线图:SVG 细线(non-scaling-stroke)+ 2x2 方块数据点 +
 * 极淡网格线,无辉光无渐变。showValues 用 HTML 覆盖层渲染数值(svg 的
 * preserveAspectRatio="none" 会拉伸内部文字);labels 在图表下方渲染
 * 横向坐标轴,与 BarChart 一致:标签在上、1px 基线在最底。data 长度 <2 时只渲染空 svg。
 */
export const LineChart = forwardRef<HTMLDivElement, LineChartProps>(
  (
    {
      data,
      tone = 'primary',
      height = 96,
      showDots = true,
      showValues = false,
      labels,
      className,
    },
    ref,
  ) => {
    const n = data.length
    let points: { x: number; y: number }[] = []
    if (n >= 2) {
      const min = Math.min(...data)
      const max = Math.max(...data)
      const span = max - min
      points = data.map((v, i) => ({
        x: (i / (n - 1)) * 100,
        // y 反转并留 5% 边距;max === min 时画中线
        y: span === 0 ? 50 : 95 - ((v - min) / span) * 90,
      }))
    }
    const pointsAttr = points.map(p => `${p.x},${p.y}`).join(' ')

    return (
      <div
        ref={ref}
        role="img"
        aria-label="LINE CHART"
        data-tone={tone}
        className={cn('w-full', className)}
      >
        <div className="relative" style={{ height }}>
          <svg
            width="100%"
            height={height}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="block"
          >
            {GRID_Y.map(y => (
              <line
                key={y}
                x1={0}
                y1={y}
                x2={100}
                y2={y}
                stroke="var(--fui-line-faint)"
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {points.length >= 2 ? (
              <polyline
                points={pointsAttr}
                fill="none"
                stroke={`var(--fui-${tone})`}
                strokeWidth={1.5}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            {showDots
              ? points.map((p, i) => (
                <rect
                  key={i}
                  x={p.x - 1}
                  y={p.y - 1}
                  width={2}
                  height={2}
                  fill={`var(--fui-${tone})`}
                />
              ))
              : null}
          </svg>
          {showValues
            ? points.map((p, i) => (
              <span
                key={i}
                data-testid="fui-line-chart-value"
                aria-hidden
                className="absolute text-[9px] leading-none text-[var(--fui-text-dim)]"
                style={{
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: 'translate(-50%, -140%)',
                }}
              >
                {data[i]}
              </span>
            ))
            : null}
        </div>
        {labels && labels.length > 0 ? (
          <>
            <div className="relative mb-1 h-3">
              {labels.map((label, i) => {
                const x =
                  labels.length === 1 ? 50 : (i / (labels.length - 1)) * 100
                const translate =
                  x === 0
                    ? 'translateX(0)'
                    : x === 100
                      ? 'translateX(-100%)'
                      : 'translateX(-50%)'
                return (
                  <span
                    key={i}
                    className="absolute text-[9px] leading-none uppercase tracking-[0.15em] text-[var(--fui-text-dim)]"
                    style={{ left: `${x}%`, transform: translate }}
                  >
                    {label}
                  </span>
                )
              })}
            </div>
            {/* 与 BarChart 一致:label 在上,基线在最底 */}
            <div aria-hidden className="border-t border-[var(--fui-line)]" />
          </>
        ) : null}
      </div>
    )
  },
)

LineChart.displayName = 'LineChart'
