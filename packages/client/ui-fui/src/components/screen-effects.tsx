import { forwardRef, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

/**
 * RGB 色散文字效果(写入 theme/fui.css 的 .fui-chromatic),
 * 直接拼到文本元素的 className 上。
 */
export const fuiChromatic = 'fui-chromatic'

export interface ScreenEffectsProps {
  /** 扫描线 + 缓慢下移的亮带 */
  scanlines?: boolean
  /** 四角压暗 */
  vignette?: boolean
  /** 整体轻微闪烁 */
  flicker?: boolean
  className?: string
  children?: ReactNode
}

/**
 * FUI 风格 CRT 氛围覆盖层:按 props 拼接 theme/fui.css 里的扫描线、暗角、
 * 闪烁三个类。自身不含样式逻辑,只负责组合。
 * 通常绝对定位铺满容器并配 pointer-events-none,以免挡住下层交互。
 * 动画都包在 prefers-reduced-motion: no-preference 内,减少动效时退化为静态。
 */
export const ScreenEffects = forwardRef<HTMLDivElement, ScreenEffectsProps>(
  (
    { scanlines = true, vignette = true, flicker = true, className, children },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-0 z-50',
          flicker && 'fui-flicker',
          className,
        )}
      >
        {scanlines ? <div className="fui-scanlines absolute inset-0" /> : null}
        {vignette ? <div className="fui-vignette absolute inset-0" /> : null}
        {children}
      </div>
    )
  },
)

ScreenEffects.displayName = 'ScreenEffects'
