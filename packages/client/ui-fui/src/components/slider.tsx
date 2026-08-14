import {
  forwardRef,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface SliderProps {
  /** 受控:当前值 */
  value?: number
  /** 非受控初始值 */
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** 左侧标签,如 THRUST */
  label?: string
  className?: string
}

/** 将值 clamp 到 [min, max] 并按 step 取整(处理浮点误差) */
function clampToStep(value: number, min: number, max: number, step: number) {
  const clamped = Math.min(max, Math.max(min, value))
  const decimals = (String(step).split('.')[1] ?? '').length
  const stepped = Number(
    (Math.round((clamped - min) / step) * step + min).toFixed(decimals),
  )
  return Math.min(max, Math.max(min, stepped))
}

/**
 * FUI 风格数值滑杆:方角方形 thumb,细轨道 + 已填充段青绿实心,
 * thumb 仅带极弱辉光。支持受控/非受控;方向键/Home/End 调整,
 * 指针按下 capture 后跟随拖动;disabled 时不可聚焦、不响应。
 */
export const Slider = forwardRef<HTMLDivElement, SliderProps>(
  (
    {
      value,
      defaultValue,
      onValueChange,
      min = 0,
      max = 100,
      step = 1,
      disabled = false,
      label,
      className,
    },
    ref,
  ) => {
    const isControlled = value !== undefined
    const [innerValue, setInnerValue] = useState(() =>
      clampToStep(defaultValue ?? min, min, max, step),
    )
    const current = clampToStep(
      isControlled ? value : innerValue,
      min,
      max,
      step,
    )
    const percent = max === min ? 0 : ((current - min) / (max - min)) * 100

    const trackRef = useRef<HTMLDivElement>(null)
    const dragging = useRef(false)

    const setValue = (next: number) => {
      const clamped = clampToStep(next, min, max, step)
      if (clamped === current) return
      if (!isControlled) setInnerValue(clamped)
      onValueChange?.(clamped)
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return
      let next: number | null = null
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        next = current + step
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        next = current - step
      } else if (event.key === 'Home') {
        next = min
      } else if (event.key === 'End') {
        next = max
      }
      if (next === null) return
      event.preventDefault()
      setValue(next)
    }

    // jsdom 中 getBoundingClientRect 全 0,这里按真实浏览器语义实现
    const setFromClientX = (clientX: number) => {
      const el = trackRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width
      setValue(min + ratio * (max - min))
    }

    const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      event.currentTarget.setPointerCapture(event.pointerId)
      dragging.current = true
      setFromClientX(event.clientX)
    }

    const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
      if (!dragging.current || disabled) return
      setFromClientX(event.clientX)
    }

    const onPointerUp = () => {
      dragging.current = false
    }

    return (
      <div ref={ref} className={cn('flex items-center gap-3', className)}>
        {label ? (
          <span className="text-[10px] uppercase leading-none tracking-[0.2em] text-[var(--fui-text-dim)]">
            {label}
          </span>
        ) : null}
        <div
          ref={trackRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={current}
          aria-disabled={disabled || undefined}
          aria-label={label}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={cn(
            'relative flex h-4 flex-1 cursor-pointer touch-none select-none items-center',
            'focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[var(--fui-primary)]',
            disabled && 'cursor-not-allowed opacity-40',
          )}
        >
          {/* 轨道 */}
          <div className="h-0.5 w-full bg-[var(--fui-line-soft)]" />
          {/* 已填充段 */}
          <div
            className="absolute left-0 h-0.5 bg-[var(--fui-primary)]"
            style={{ width: `${percent}%` }}
          />
          {/* 方形 thumb,极弱辉光 */}
          <div
            className="absolute h-3 w-3 -translate-x-1/2 bg-[var(--fui-primary)] shadow-[var(--fui-glow-sm)]"
            style={{ left: `${percent}%` }}
          />
        </div>
      </div>
    )
  },
)

Slider.displayName = 'Slider'
