import { forwardRef } from 'react'
import { cn } from '../lib/cn.ts'

export type LoadingSize = 'sm' | 'md' | 'lg'
export type LoadingVariant = 'blocks' | 'line' | 'square'

export interface LoadingProps {
  /** spinner 类型:blocks(分段方块,默认)/ line(单线旋转)/ square(方框步进) */
  variant?: LoadingVariant
  /** 右侧标签,dim 小字大写 */
  label?: string
  size?: LoadingSize
  className?: string
}

const BLOCKS = 8
/** 每块脉冲动画错峰间隔(秒) */
const STAGGER = 0.125

const blockSizeClass: Record<LoadingSize, string> = {
  sm: 'h-1.5 w-0.5',
  md: 'h-2 w-1',
  lg: 'h-3 w-1.5',
}

/** line 的外框尺寸 */
const spinnerSizeClass: Record<LoadingSize, string> = {
  sm: 'h-3 w-3',
  md: 'h-4 w-4',
  lg: 'h-6 w-6',
}

/** square 单块尺寸(2×2 追逐脉冲) */
const squareBlockSizeClass: Record<LoadingSize, string> = {
  sm: 'h-1 w-1',
  md: 'h-1.5 w-1.5',
  lg: 'h-2 w-2',
}

/** square 四块的错峰延迟:左上 → 右上 → 右下 → 左下,顺时针追逐 */
const SQUARE_DELAYS = [0, 0.25, 0.75, 0.5]

/**
 * FUI 风格加载指示,三种形态:
 * - blocks:一排 8 个方块依次点亮循环
 * - line:一根线绕中心匀速旋转(雷达指针,线画在满幅元素上半幅,
 *   绕元素正中心旋转)
 * - square:2×2 方块渐隐渐显,顺时针追逐(blocks 脉冲的方形排布)
 * 动画由 theme/fui.css 提供(包在 prefers-reduced-motion: no-preference
 * 内);reduced-motion 时全部退化为静态。
 */
export const Loading = forwardRef<HTMLDivElement, LoadingProps>(
  ({ variant = 'blocks', label, size = 'md', className }, ref) => {
    return (
      <div
        ref={ref}
        role="status"
        aria-label={label ?? 'LOADING'}
        className={cn('inline-flex items-center gap-2', className)}
      >
        {variant === 'blocks' ? (
          <span aria-hidden className="flex items-center gap-[3px]">
            {Array.from({ length: BLOCKS }, (_, i) => (
              <span
                key={i}
                data-testid="fui-loading-block"
                className={cn('fui-loading-block', blockSizeClass[size])}
                style={{ animationDelay: `${i * STAGGER}s` }}
              />
            ))}
          </span>
        ) : null}
        {variant === 'line' ? (
          /* 线画在满幅元素上半幅,绕元素正中心旋转,中心不会偏 */
          <span
            aria-hidden
            data-testid="fui-loading-line"
            className={cn('fui-loading-line', spinnerSizeClass[size])}
          />
        ) : null}
        {variant === 'square' ? (
          /* 2×2 方块渐隐渐显,顺时针追逐,复用 blocks 的脉冲动画 */
          <span aria-hidden className="grid grid-cols-2 gap-[2px]">
            {SQUARE_DELAYS.map((delay, i) => (
              <span
                key={i}
                data-testid="fui-loading-square-block"
                className={cn('fui-loading-block', squareBlockSizeClass[size])}
                style={{ animationDelay: `${delay}s` }}
              />
            ))}
          </span>
        ) : null}
        {label ? (
          <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--fui-text-dim)]">
            {label}
          </span>
        ) : null}
      </div>
    )
  },
)

Loading.displayName = 'Loading'
