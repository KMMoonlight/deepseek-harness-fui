import {
  forwardRef,
  useEffect,
  useState,
  type ElementType,
  type HTMLAttributes,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface TextProps extends HTMLAttributes<HTMLElement> {
  /** 辉光 */
  glow?: boolean
  /** 弱化(次要信息) */
  dim?: boolean
  uppercase?: boolean
  /** 逐字打出 */
  typing?: boolean
  /** 打字速度(字符/秒),默认 30 */
  cps?: number
  /** 打字完成回调 */
  onTypingDone?: () => void
  /** 渲染元素,默认 span */
  as?: ElementType
  children?: string
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * FUI 风格终端文本:支持弱化、全大写宽字距、极弱青绿辉光,
 * 以及逐字打出的打字机效果(typing)。
 * 打字动画会先检测 prefers-reduced-motion,用户要求减少动效时直接整段显示。
 * as 可换渲染元素,children 只接受字符串 —— 打字需要按字符切分。
 */
export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      glow,
      dim,
      uppercase,
      typing,
      cps = 30,
      onTypingDone,
      as: Tag = 'span',
      className,
      children = '',
      ...rest
    },
    ref,
  ) => {
    const full = String(children)
    const skipAnimation = !typing || prefersReducedMotion()
    const [shown, setShown] = useState(() => (skipAnimation ? full.length : 0))

    useEffect(() => {
      if (skipAnimation) return
      let raf = 0
      let start: number | null = null
      const tick = (now: number) => {
        if (start === null) start = now
        const n = Math.min(
          full.length,
          Math.floor(((now - start) / 1000) * cps),
        )
        setShown(n)
        if (n < full.length) {
          raf = requestAnimationFrame(tick)
        } else {
          onTypingDone?.()
        }
      }
      raf = requestAnimationFrame(tick)
      return () => cancelAnimationFrame(raf)
    }, [full, cps, skipAnimation, onTypingDone])

    return (
      <Tag
        ref={ref}
        className={cn(
          'font-fui',
          dim ? 'text-[var(--fui-text-dim)]' : 'text-[var(--fui-text)]',
          uppercase && 'uppercase tracking-[0.2em]',
          className,
        )}
        style={
          glow
            ? {
              textShadow: 'var(--fui-text-glow)',
            }
            : undefined
        }
        {...rest}
      >
        {skipAnimation ? full : full.slice(0, shown)}
      </Tag>
    )
  },
)

Text.displayName = 'Text'
