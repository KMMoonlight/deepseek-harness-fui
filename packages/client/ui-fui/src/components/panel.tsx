import { forwardRef, type CSSProperties, type ReactNode } from 'react'
import { cn } from '../lib/cn.ts'

export type PanelVariant = 'default' | 'accent' | 'warn'

export interface PanelProps {
  /** 切角尺寸(px),默认 0(FUI 风格面板为直角),>0 时四角切角 */
  cornerSize?: number
  variant?: PanelVariant
  /** 面板标题:嵌在顶边框上(边框断开),渲染为 `TITLE ◆`,菱形为线上的节点 */
  title?: string
  className?: string
  children?: ReactNode
}

const variantLine: Record<PanelVariant, string> = {
  default: 'var(--fui-line)',
  accent: 'var(--fui-accent)',
  warn: 'var(--fui-warn)',
}

/** FUI 风格:辉光近乎不可见 */
const variantGlow: Record<PanelVariant, string> = {
  default: 'var(--fui-panel-glow)',
  accent: 'var(--fui-panel-glow-accent)',
  warn: 'var(--fui-panel-glow-warn)',
}

/** 四角切角的 polygon(corner 为 0 时退化为矩形) */
function cutCornerPolygon(corner: number): string {
  const c = `${corner}px`
  return `polygon(${c} 0, calc(100% - ${c}) 0, 100% ${c}, 100% calc(100% - ${c}), calc(100% - ${c}) 100%, ${c} 100%, 0 calc(100% - ${c}), 0 ${c})`
}

/**
 * FUI 风格面板:方角 + 1px 薄描边 + 不透明面板底色,辉光近乎不可见。
 * 标题骑在顶边框上(边框断开),渲染为 `TITLE ◆`。
 * cornerSize > 0 时四角切角,用两层嵌套 + clipPath 实现:
 * 外层是描边色、内层 inset-px 是面板底色,透出 1px 描边。
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    { cornerSize = 0, variant = 'default', title, className, children },
    ref,
  ) => {
    const clipPath = cutCornerPolygon(cornerSize)
    const outerStyle: CSSProperties = {
      clipPath,
      background: variantLine[variant],
      filter: variantGlow[variant],
    }
    const innerStyle: CSSProperties = {
      clipPath,
      // 不透明面板底色:半透明 panel-bg 叠在描边层上会透出下层颜色
      background: 'var(--fui-panel-solid)',
    }

    return (
      <div ref={ref} className={cn('relative', className)}>
        {/* 描边层与面板底色层:clip-path 只作用于这两个绝对定位的背景层,
            不会裁到探出顶边框的标题(clip-path 会裁掉自身区域外的后代) */}
        <div
          aria-hidden
          data-testid="fui-panel-frame"
          className="absolute inset-0"
          style={outerStyle}
        />
        <div aria-hidden className="absolute inset-px" style={innerStyle} />
        {title ? (
          /* 标题嵌在顶边框上:实色底衬把边框线断开,菱形为线上的节点 */
          <div
            data-testid="fui-panel-title"
            className="absolute left-3 top-0 z-10 flex -translate-y-1/2 items-center gap-1.5 bg-[var(--fui-bg)] px-1.5 text-[10px] tracking-[0.25em] uppercase text-[var(--fui-text)]"
          >
            {title}
            <span className="text-[var(--fui-primary)]">◆</span>
          </div>
        ) : null}
        <div className="relative flex h-full flex-col p-4">{children}</div>
      </div>
    )
  },
)

Panel.displayName = 'Panel'
