import {
  forwardRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface CarouselItem {
  /** 幻灯片标签:显示在视口顶部,大写宽字距小字 */
  label?: string
  content: ReactNode
}

export interface CarouselProps {
  items: CarouselItem[]
  /** 受控:当前索引 */
  index?: number
  /** 非受控初始索引 */
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  /** 到首尾后是否回绕,默认 true */
  loop?: boolean
  /** 是否显示底部右侧 x/N 计数,默认 true */
  showCounter?: boolean
  className?: string
}

const controlButtonClass = cn(
  'inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center border text-xs leading-none',
  'border-[var(--fui-line)] bg-[var(--fui-panel-bg)] text-[var(--fui-text-dim)]',
  'transition-colors duration-150 motion-reduce:transition-none',
  'hover:border-[var(--fui-line-strong)] hover:text-[var(--fui-text)]',
  'disabled:cursor-not-allowed disabled:opacity-40',
)

/**
 * FUI 风格轮播:方角薄边视口,瞬时切换(无滑动动画)。
 * 顶部标签行下 1px dashed 分隔线;‹ › 翻页按钮置于内容文字左右两侧;
 * 底部为分段方块指示器(当前格 primary 实心,其余淡钢蓝描边,
 * 同 ProgressBar 的分段语言)+ 右侧 x/N 计数(showCounter 可关)。键盘:焦点在组件内时 ←/→ 翻页。
 */
export const Carousel = forwardRef<HTMLDivElement, CarouselProps>(
  (
    {
      items,
      index,
      defaultIndex = 0,
      onIndexChange,
      loop = true,
      showCounter = true,
      className,
    },
    ref,
  ) => {
    const isControlled = index !== undefined
    const [innerIndex, setInnerIndex] = useState(defaultIndex)
    const current = isControlled ? index : innerIndex
    const count = items.length
    const item = items[current]

    const goTo = (next: number) => {
      if (count === 0) return
      let resolved = next
      if (loop) {
        resolved = (next + count) % count
      } else if (next < 0 || next >= count) {
        return
      }
      if (resolved === current) return
      if (!isControlled) setInnerIndex(resolved)
      onIndexChange?.(resolved)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goTo(current + 1)
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goTo(current - 1)
      }
    }

    if (count === 0) return null

    return (
      <div
        ref={ref}
        role="region"
        aria-roledescription="carousel"
        onKeyDown={onKeyDown}
        className={cn(
          'flex flex-col border border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
          className,
        )}
      >
        {item?.label ? (
          <div className="border-b border-dashed border-[var(--fui-line)] px-3 py-2 text-[10px] uppercase tracking-[0.25em] text-[var(--fui-text-dim)]">
            {item.label}
          </div>
        ) : null}
        <div className="flex items-center gap-2 px-3 py-3">
          <button
            type="button"
            aria-label="previous slide"
            disabled={!loop && current === 0}
            onClick={() => goTo(current - 1)}
            className={controlButtonClass}
          >
            ‹
          </button>
          <div
            role="group"
            aria-roledescription="slide"
            aria-label={`${current + 1} of ${count}`}
            className="min-h-10 flex-1 text-xs text-[var(--fui-text)]"
          >
            {item?.content}
          </div>
          <button
            type="button"
            aria-label="next slide"
            disabled={!loop && current === count - 1}
            onClick={() => goTo(current + 1)}
            className={controlButtonClass}
          >
            ›
          </button>
        </div>
        <div className="flex items-center gap-3 px-3 pb-2">
          <div className="flex flex-1 items-center justify-center gap-[3px]">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`slide ${i + 1}`}
                aria-current={i === current ? 'true' : undefined}
                onClick={() => goTo(i)}
                className="h-1.5 w-1.5 cursor-pointer"
                style={
                  i === current
                    ? {
                      background: 'var(--fui-primary)',
                      boxShadow: 'var(--fui-glow-sm)',
                    }
                    : {
                      background: 'var(--fui-line-faint)',
                      border: '1px solid var(--fui-line-soft)',
                    }
                }
              />
            ))}
          </div>
          {showCounter ? (
            <span className="shrink-0 text-[10px] tracking-[0.12em] text-[var(--fui-text-dim)]">
              {current + 1}/{count}
            </span>
          ) : null}
        </div>
      </div>
    )
  },
)

Carousel.displayName = 'Carousel'
