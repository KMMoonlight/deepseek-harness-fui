import { forwardRef, useEffect, useRef } from 'react'
import { cn } from '../lib/cn.ts'

export type WireframeTone = 'primary' | 'warn' | 'accent'

export interface WireframeModel {
  /** 顶点坐标,x,y,z 扁平存放(长度必为 3 的倍数) */
  vertices: Float32Array
  /** 边的顶点索引对,每两个数字一条线段(长度必为 2 的倍数) */
  edges: Uint16Array
}

export interface WireframeProps {
  /**
   * 三维线框模型。**引用要保持稳定**(模块级常量或 useMemo)——
   * 换引用会重建整条渲染管线的预分配缓冲。
   */
  model: WireframeModel
  /** 线条色,默认 primary;远近同色,深度只由透明度表达 */
  tone?: WireframeTone
  /** 画布高度(px),默认 200 */
  height?: number
  /** 绕 Y 轴转速(度/秒),默认 12;为 0 时只画一帧静态图 */
  speed?: number
  /** 俯仰角(度),默认 -16(略微俯视);draggable 时这是初始值,拖动后由用户接管 */
  pitch?: number
  /** 在自动适配的基础上再缩放,默认 1 */
  zoom?: number
  /** 坐标量化网格(px),默认 1(整数像素对齐);调到 2~3 采样感更强,0 关闭 */
  quantize?: number
  /** 透视强度,越大越接近正交投影,默认 6;<=0 为纯正交 */
  perspective?: number
  /** 极弱外辉光(drop-shadow),默认关 */
  glow?: boolean
  /** 按住拖拽改变视角(左右转 yaw、上下调 pitch),松手回到自动自转 */
  draggable?: boolean
  /**
   * 点击顶点的回调,命中传顶点索引、空白处传 null。
   * **传了这个 prop 才启用命中测试**,不传时鼠标全程零开销。
   * canvas 里的命中没有键盘等价物,键盘可达要靠 hotspots。
   */
  onPick?: (vertex: number | null) => void
  /** 命中半径(px),默认 10 */
  pickRadius?: number
  /**
   * 键盘可达的热点。每个热点在对应顶点上盖一个绝对定位的透明 <button>——
   * 焦点、Tab 顺序、Enter/Space 激活、读屏播报全部交给浏览器原生行为,
   * canvas 只管画。激活时按顶点索引调 onPick,和鼠标点击同一条出口。
   *
   * 位置由渲染循环直接写 DOM transform,不经过 React state ——
   * 每帧 setState 会让 React 陪着动画一起 reconcile。
   * 只给语义上有意义的少数顶点用(几十个量级),不是给每个顶点都配一个。
   * 引用要保持稳定(模块级常量或 useMemo)。
   */
  hotspots?: WireframeHotspot[]
  /**
   * 模型分区:把边分成若干有语义的区域(一片太阳能板、一段桁架…)。
   * 配 pickMode="group" 用 —— 命中粒度从单个顶点变成整片区域。
   * 悬停给整片铺一层淡填充,选中则是深填充 + 提亮轮廓 + 包围盒四角标记,
   * 读起来是"锁定了一片",而不是"挑亮了一堆点"。引用要保持稳定。
   *
   * 填充范围是分区投影顶点的**凸包** —— 模型只有边没有面,只能这么反推。
   * 板、桁架、舱体这类凸结构是准的;环状分区的凸包会把中间的洞一起盖上,
   * 需要精确形状就把环拆成若干段小分区。
   *
   * 组模式下影子层按组生成按钮,所以键盘用户拿到的也是"一片一片",
   * 和鼠标同一套粒度。
   */
  groups?: WireframeGroup[]
  /**
   * 拾取粒度,默认 vertex。
   * group 需要同时传 groups,否则命中不到任何东西。
   */
  pickMode?: 'vertex' | 'group'
  /** 受控:选中的分区下标,null 为无选中(组模式) */
  selected?: number | null
  /** 选中变化(组模式):点中分区传下标,点空白传 null */
  onSelect?: (group: number | null) => void
  /** 无障碍名称,默认 WIREFRAME */
  label?: string
  className?: string
}

export interface WireframeHotspot {
  /** 对应 model.vertices 里的顶点索引,越界的热点会被隐藏 */
  vertex: number
  /** 读屏播报的名称,也是 aria-label */
  label: string
}

export interface WireframeGroup {
  /** 分区名,同时用作按钮的 aria-label */
  label: string
  /**
   * 组内边的下标 —— 指 model.edges 里的**第几条边**(不是顶点下标)。
   * 一条边最多属于一个组,重复归属时后写的组赢。
   */
  edges: number[]
}

/**
 * 深度分档对应的线条不透明度(远 → 近)。
 *
 * 不做隐藏面消除,被挡住的线照画,只是压暗 —— 背面看得见才有体积感。
 *
 * 远近**同色**,深度只由这组透明度表达。早先远端换成钢蓝结构色,
 * 结果是压到 0.4 上下时在深海军蓝底上直接融进背景:换色相等于同时削掉
 * 亮度和对比,两头一起丢。参考风格本来也是单色线框。
 *
 * 下限 0.5 是按抗锯齿反推的,不是拍脑袋:1px 斜线的覆盖率摊到相邻像素上,
 * 实测最暗像素只有设定值的三分之一左右。再往下调,平板类结构一转到侧对视角
 * 就彻底看不见了 —— 未选中的部分也得始终读得出来。
 *
 * 分五档而不是三档,是为了让边在旋转中跨过档位阈值时不出现可见的亮度跳变;
 * 代价只是一帧多两次 stroke。透明度走 ctx.globalAlpha 而不是带 alpha 的
 * 色值字面量:既守住"组件里不写色值"这条约定,也让一档只需要一次 stroke。
 */
const DEPTH_ALPHA = [0.5, 0.62, 0.75, 0.87, 1]

/** 模型外接球到画布短边的填充比例,留出一点呼吸 */
const FIT_RATIO = 0.86

/** 命中高亮方块的边长(px),与 LineChart 的方块数据点是同一套语言 */
const HIT_SQUARE = 6

/** 拖拽位移不超过这个像素数就按点击处理,避免"拖完顺手选中" */
const DRAG_SLOP = 4

/** 拖拽灵敏度(度/px)与俯仰上限(超过就翻面了,没意义) */
const DRAG_YAW_PER_PX = 0.5
const DRAG_PITCH_PER_PX = 0.4
const MAX_PITCH = 85

/** 热点按钮的边长(px),比命中方块大一圈,够手指点 */
const HOTSPOT_SIZE = 16

/** 悬停分区的线条亮度,压在选中态之下,两者才分得开 */
const GROUP_HOVER_ALPHA = 0.85

/**
 * 分区填充的不透明度。整片铺一层同色底才读得出"选中的是一片区域",
 * 只把线挑亮看起来像是选中了一堆点。
 * 悬停用 8%,和 --fui-<tone>-soft 那套 hover 填充是同一个量级。
 */
const GROUP_HOVER_FILL = 0.08
const GROUP_SELECT_FILL = 0.28

/**
 * 选中分区的四角标记:外扩距离与臂长(px)。
 * 光靠填充和提亮还是"这片有点不一样",四个角标才是明确的"锁定了这片" ——
 * 这是 FUI 里标目标的通用写法,而且不往线框里加噪声。
 */
const BRACKET_PAD = 6
const BRACKET_ARM = 12

/**
 * 角标包围盒的最小边长(px)。
 * 平板类分区转到侧对视角时投影会塌成一条线 —— 填充没面积可铺,包围盒也跟着缩没,
 * 标识就在某些角度凭空消失了。角标是屏幕空间的标记,不该跟着投影一起缩。
 */
const BRACKET_MIN = 30

/** 不传时用同一个空数组,免得每次渲染都是新引用把 effect 冲掉 */
const NO_HOTSPOTS: WireframeHotspot[] = []
const NO_GROUPS: WireframeGroup[] = []

/** 点到线段距离的平方 —— 组模式的命中要整条边可点,不能只认端点 */
function segDist2(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  mx: number,
  my: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  let t = len2 === 0 ? 0 : ((mx - ax) * dx + (my - ay) * dy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const ex = mx - (ax + t * dx)
  const ey = my - (ay + t * dy)
  return ex * ex + ey * ey
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

/**
 * FUI 风格三维线框渲染器:canvas 2D 画正交/弱透视线框,绕 Y 轴匀速自转。
 *
 * 只吃几何(顶点 + 边索引),不吃任何样式 —— 颜色从 --fui-* token 运行时读取,
 * 换 data-fui-theme 会自动跟着变;透明度按边的深度分档(背面淡、正面亮),
 * 这是体积感的全部来源,不做光照也不做隐藏面消除 —— 被挡住的线照画,只是压暗。
 *
 * 性能上每帧零分配:顶点/深度/分桶缓冲在挂载时按模型规模预分配,
 * 每帧只做一次矩阵求值 + 每桶一次 stroke(而不是每条边一次)。
 * 元素滚出视口时用 IntersectionObserver 暂停 rAF。
 *
 * 交互(draggable / onPick / 分区选择)全部走闭包变量而不是 React state ——
 * 每帧都会变的量一旦进 state,React 就会陪着动画每帧 reconcile 一遍。
 * 命中测试复用每帧已经算好的投影坐标:顶点模式是 O(顶点数) 的最近点查找,
 * 组模式是 O(边数) 的最近线段查找(整条边可点,不是只有端点)。
 *
 * 动画尊重 prefers-reduced-motion:要求减少动效时只画一帧静态姿态,不启动 rAF;
 * 此时拖拽与 hover 仍然可用,靠单帧重绘驱动。
 */
export const Wireframe = forwardRef<HTMLDivElement, WireframeProps>(
  (
    {
      model,
      tone = 'primary',
      height = 200,
      speed = 12,
      pitch = -16,
      zoom = 1,
      quantize = 1,
      perspective = 6,
      glow = false,
      draggable = false,
      onPick,
      pickRadius = 10,
      hotspots,
      groups,
      pickMode = 'vertex',
      selected = null,
      onSelect,
      label = 'WIREFRAME',
      className,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const spotRefs = useRef<(HTMLButtonElement | null)[]>([])
    const groupList = groups ?? NO_GROUPS
    const grouping = pickMode === 'group' && groupList.length > 0
    // 影子层的按钮:组模式一组一个(定位在质心),顶点模式用 hotspots
    const spots = grouping ? groupList : (hotspots ?? NO_HOTSPOTS)
    // 视角跨 effect 重建保留,否则改个 tone 都会让模型跳回初始姿态
    const yawRef = useRef(0)
    const pitchRef = useRef(pitch)
    const pitchPropRef = useRef(pitch)
    // 回调每次渲染都是新引用,进 deps 会让整条管线跟着重建
    const onPickRef = useRef(onPick)
    const onSelectRef = useRef(onSelect)
    // 选中态每次点击都变,进 deps 会重建管线,所以走 ref + 主动请求一帧
    const selectedRef = useRef(selected)
    const requestFrameRef = useRef<(() => void) | null>(null)
    const picking = onPick !== undefined

    useEffect(() => {
      onPickRef.current = onPick
      onSelectRef.current = onSelect
    })

    useEffect(() => {
      selectedRef.current = selected
      requestFrameRef.current?.()
    }, [selected])

    useEffect(() => {
      const canvas = canvasRef.current
      if (!canvas) return
      // jsdom 等无 2D 上下文的环境直接放弃渲染,不报错
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // pitch prop 变化时收回控制权,其余情况沿用用户拖出来的角度
      if (pitchPropRef.current !== pitch) {
        pitchPropRef.current = pitch
        pitchRef.current = pitch
      }

      const verts = model.vertices
      const edges = model.edges
      const vertCount = Math.floor(verts.length / 3)
      const edgeCount = Math.floor(edges.length / 2)

      // 每帧复用的缓冲:投影后的屏幕坐标 + 归一化深度
      const px = new Float32Array(vertCount)
      const py = new Float32Array(vertCount)
      const pz = new Float32Array(vertCount)
      // 深度桶的边下标,按最坏情况预分配
      const buckets = DEPTH_ALPHA.map(() => new Int32Array(edgeCount))
      const counts = new Int32Array(DEPTH_ALPHA.length)
      // 高亮的两桶(悬停分区 / 选中分区)不参与深度分档,整片一个亮度
      const hoverBucket = new Int32Array(edgeCount)
      const selectBucket = new Int32Array(edgeCount)

      // 边 → 分区的反查表,建一次用到底;-1 表示不属于任何分区
      const edgeGroup = new Int16Array(edgeCount).fill(-1)
      // 每个分区涉及的顶点(去重),用来算质心和画选中态的方块
      const groupVerts: Int32Array[] = []
      for (let gi = 0; gi < groupList.length; gi++) {
        const seen = new Set<number>()
        for (const e of groupList[gi].edges) {
          if (e < 0 || e >= edgeCount) continue
          edgeGroup[e] = gi
          const a = edges[e * 2]
          const b = edges[e * 2 + 1]
          if (a < vertCount) seen.add(a)
          if (b < vertCount) seen.add(b)
        }
        groupVerts.push(Int32Array.from(seen))
      }
      // 分区质心的屏幕坐标,每帧算一次给影子层按钮定位
      const groupCx = new Float32Array(groupList.length)
      const groupCy = new Float32Array(groupList.length)
      // 凸包的临时缓冲,按最大分区预分配 —— 一帧最多算两个包(悬停 + 选中)
      let maxGroupVerts = 0
      for (const list of groupVerts) {
        if (list.length > maxGroupVerts) maxGroupVerts = list.length
      }
      const hullOrder = new Int32Array(maxGroupVerts)
      const hullStack = new Int32Array(maxGroupVerts * 2 + 1)

      // 外接球半径 → 任意单位的模型都能自动适配画布
      let radius = 0
      for (let i = 0; i + 2 < verts.length; i += 3) {
        const d = Math.hypot(verts[i], verts[i + 1], verts[i + 2])
        if (d > radius) radius = d
      }
      if (radius === 0) radius = 1

      // token 只在挂载与主题切换时读一次 —— 每帧 getComputedStyle 会强制样式重算
      // 远近同色,深度只由 globalAlpha 表达 —— 换色相会让远端在深色底上直接糊掉
      let lineColor = ''
      const readPalette = () => {
        const cs = getComputedStyle(canvas)
        // token 缺失(未装 theme)时退回继承色,不写死任何色值
        const fallback = cs.color
        lineColor = cs.getPropertyValue(`--fui-${tone}`).trim() || fallback
      }
      readPalette()

      let dpr = 0
      let cssW = 0
      const resize = () => {
        const nextDpr = window.devicePixelRatio || 1
        const nextW = canvas.clientWidth || 0
        if (nextW === cssW && nextDpr === dpr) return
        cssW = nextW
        dpr = nextDpr
        canvas.width = Math.max(1, Math.round(cssW * dpr))
        canvas.height = Math.max(1, Math.round(height * dpr))
      }

      const q = quantize > 0 ? quantize : 0

      let yaw = yawRef.current
      let pitchDeg = pitchRef.current
      // 指针状态与命中结果都是闭包变量:每帧都可能变,进 React state 就废了
      let pointerX = -1
      let pointerY = -1
      let pointerInside = false
      let hovered = -1
      let dragging = false
      let dragMoved = 0
      let lastClientX = 0
      let lastClientY = 0
      let cursor = ''
      // 热点的焦点/悬停,和 canvas 的 hovered 走同一套高亮
      let focusedSpot = -1
      let hoveredSpot = -1
      // 组模式下鼠标压着的分区
      let hoveredGroup = -1

      /** 复用当前帧的投影坐标做最近点查找 —— 命中测试的全部成本就是这一趟 */
      const pickAt = (mx: number, my: number) => {
        let best = -1
        let bestD = pickRadius * pickRadius
        for (let i = 0; i < vertCount; i++) {
          const dx = px[i] - mx
          const dy = py[i] - my
          const d = dx * dx + dy * dy
          if (d < bestD) {
            bestD = d
            best = i
          }
        }
        return best
      }

      /**
       * 组模式的命中:按点到线段的距离找最近的边,再反查它属于哪个分区。
       * 用线段而不是端点,整片板子才处处可点,而不是只有格点能点中。
       */
      const pickGroupAt = (mx: number, my: number) => {
        let best = -1
        let bestD = pickRadius * pickRadius
        for (let e = 0, p = 0; e < edgeCount; e++, p += 2) {
          const gi = edgeGroup[e]
          if (gi < 0) continue
          const a = edges[p]
          const b = edges[p + 1]
          if (a >= vertCount || b >= vertCount) continue
          const d = segDist2(px[a], py[a], px[b], py[b], mx, my)
          if (d < bestD) {
            bestD = d
            best = gi
          }
        }
        return best
      }

      /**
       * 单调链凸包:把分区的投影顶点围成一个可填充的多边形。
       * 模型只有边没有面,填充区域只能这么反推出来 —— 对板、桁架、舱体这类
       * 凸的结构是准的;环状分区的包会把中间的洞也盖上(见 groups 的文档)。
       * 返回包上点的个数,点存在 hullStack 前 k 位。
       */
      const buildHull = (list: Int32Array) => {
        const n = list.length
        if (n < 3) return 0
        for (let i = 0; i < n; i++) hullOrder[i] = list[i]
        // 按 x、y 排序;n 是单个分区的顶点数(几十),插入排序足够且不分配
        for (let i = 1; i < n; i++) {
          const v = hullOrder[i]
          let j = i - 1
          while (
            j >= 0 &&
            (px[hullOrder[j]] > px[v] ||
              (px[hullOrder[j]] === px[v] && py[hullOrder[j]] > py[v]))
          ) {
            hullOrder[j + 1] = hullOrder[j]
            j--
          }
          hullOrder[j + 1] = v
        }
        const cross = (o: number, a: number, b: number) =>
          (px[a] - px[o]) * (py[b] - py[o]) - (py[a] - py[o]) * (px[b] - px[o])
        let k = 0
        for (let i = 0; i < n; i++) {
          while (
            k >= 2 &&
            cross(hullStack[k - 2], hullStack[k - 1], hullOrder[i]) <= 0
          ) {
            k--
          }
          hullStack[k++] = hullOrder[i]
        }
        const lower = k + 1
        for (let i = n - 2; i >= 0; i--) {
          while (
            k >= lower &&
            cross(hullStack[k - 2], hullStack[k - 1], hullOrder[i]) <= 0
          ) {
            k--
          }
          hullStack[k++] = hullOrder[i]
        }
        // 末点与首点重合,去掉
        return k - 1
      }

      /** 整片铺底:这才是"选中一片区域"的视觉主体,线条只是轮廓 */
      const fillGroup = (gi: number, alpha: number) => {
        if (gi < 0 || gi >= groupVerts.length) return
        const k = buildHull(groupVerts[gi])
        if (k < 3) return
        ctx.globalAlpha = alpha
        ctx.fillStyle = lineColor
        ctx.beginPath()
        ctx.moveTo(px[hullStack[0]], py[hullStack[0]])
        for (let i = 1; i < k; i++) {
          ctx.lineTo(px[hullStack[i]], py[hullStack[i]])
        }
        ctx.closePath()
        ctx.fill()
      }

      /**
       * 选中分区的四角标记,画在屏幕空间的包围盒上(不跟着模型转)——
       * HUD 里"锁定目标"就是这么标的,一眼能认,也不往线框里加噪声。
       */
      const strokeBrackets = (gi: number) => {
        if (gi < 0 || gi >= groupVerts.length) return
        const list = groupVerts[gi]
        if (list.length === 0) return
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (let i = 0; i < list.length; i++) {
          const v = list[i]
          if (px[v] < x0) x0 = px[v]
          if (px[v] > x1) x1 = px[v]
          if (py[v] < y0) y0 = py[v]
          if (py[v] > y1) y1 = py[v]
        }
        // px/py 已经带了半像素对齐,减去整数外扩量不会破坏对齐
        x0 -= BRACKET_PAD
        y0 -= BRACKET_PAD
        x1 += BRACKET_PAD
        y1 += BRACKET_PAD
        // 侧对视角时投影塌成一条线,把盒子撑到最小尺寸,标识才不会跟着消失
        if (x1 - x0 < BRACKET_MIN) {
          const mid = (x0 + x1) / 2
          x0 = mid - BRACKET_MIN / 2
          x1 = mid + BRACKET_MIN / 2
        }
        if (y1 - y0 < BRACKET_MIN) {
          const mid = (y0 + y1) / 2
          y0 = mid - BRACKET_MIN / 2
          y1 = mid + BRACKET_MIN / 2
        }
        // 区域小的时候臂长跟着缩,不然四个角会连成一个完整方框
        const arm = Math.max(
          3,
          Math.min(BRACKET_ARM, (x1 - x0) / 3, (y1 - y0) / 3),
        )
        ctx.globalAlpha = 1
        ctx.strokeStyle = lineColor
        ctx.beginPath()
        ctx.moveTo(x0, y0 + arm)
        ctx.lineTo(x0, y0)
        ctx.lineTo(x0 + arm, y0)
        ctx.moveTo(x1 - arm, y0)
        ctx.lineTo(x1, y0)
        ctx.lineTo(x1, y0 + arm)
        ctx.moveTo(x1, y1 - arm)
        ctx.lineTo(x1, y1)
        ctx.lineTo(x1 - arm, y1)
        ctx.moveTo(x0 + arm, y1)
        ctx.lineTo(x0, y1)
        ctx.lineTo(x0, y1 - arm)
        ctx.stroke()
      }

      const updateCursor = () => {
        const hit = grouping ? hoveredGroup >= 0 : hovered >= 0
        const next = dragging
          ? 'grabbing'
          : hit
            ? 'pointer'
            : draggable
              ? 'grab'
              : ''
        if (next === cursor) return
        cursor = next
        canvas.style.cursor = next
      }

      const draw = () => {
        yawRef.current = yaw
        pitchRef.current = pitchDeg
        resize()
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, cssW, height)
        if (cssW === 0 || vertCount === 0 || edgeCount === 0) return

        const cx = cssW / 2
        const cy = height / 2
        const scale =
          ((Math.min(cssW, height) / 2) * FIT_RATIO * zoom) / radius
        // dpr=1 时半像素偏移才能得到真正的 1px 硬线;高倍屏上整数坐标本就锐利
        const half = dpr === 1 ? 0.5 : 0

        // R = RotX(pitch) · RotY(yaw),每帧只求值一次
        const pitchRad = (pitchDeg * Math.PI) / 180
        const cosP = Math.cos(pitchRad)
        const sinP = Math.sin(pitchRad)
        const cosY = Math.cos(yaw)
        const sinY = Math.sin(yaw)
        const m00 = cosY
        const m02 = sinY
        const m10 = sinP * sinY
        const m11 = cosP
        const m12 = -sinP * cosY
        const m20 = -cosP * sinY
        const m21 = sinP
        const m22 = cosP * cosY

        for (let i = 0, v = 0; i < vertCount; i++, v += 3) {
          const x = verts[v]
          const y = verts[v + 1]
          const z = verts[v + 2]
          const rx = m00 * x + m02 * z
          const ry = m10 * x + m11 * y + m12 * z
          const rz = m20 * x + m21 * y + m22 * z
          // 归一化深度:+z 背离观察者
          const nz = rz / radius
          const k = perspective > 0 ? perspective / (perspective + nz) : 1
          let sx = cx + rx * scale * k
          let sy = cy - ry * scale * k
          if (q > 0) {
            sx = Math.round(sx / q) * q
            sy = Math.round(sy / q) * q
          }
          px[i] = sx + half
          py[i] = sy + half
          pz[i] = nz
        }

        // 命中测试放在投影之后:用的是这一帧的新坐标,不会比画面慢一拍
        const live = pointerInside && !dragging
        hovered =
          picking && !grouping && live ? pickAt(pointerX, pointerY) : -1
        hoveredGroup = grouping && live ? pickGroupAt(pointerX, pointerY) : -1

        // 分区的抓手位置:算质心,再取组内**离质心最远**的顶点。
        //
        // 不能直接用质心 —— 环形分区的质心是圆心,那儿是空的,还常压着别的分区。
        // 也不能取离质心最近的顶点:环压扁成椭圆后,最近的点恰好挤在中轴上,
        // 一样和中央结构叠在一起。取最远点会把抓手推到区域的外缘,
        // 既保证落在自己的几何上,又天然避开拥挤的中心。
        for (let gi = 0; gi < groupVerts.length; gi++) {
          const list = groupVerts[gi]
          if (list.length === 0) {
            groupCx[gi] = -1
            groupCy[gi] = -1
            continue
          }
          let sx = 0
          let sy = 0
          for (let i = 0; i < list.length; i++) {
            sx += px[list[i]]
            sy += py[list[i]]
          }
          const mx = sx / list.length
          const my = sy / list.length
          let best = list[0]
          let bestD = -1
          for (let i = 0; i < list.length; i++) {
            const v = list[i]
            const dx = px[v] - mx
            const dy = py[v] - my
            const d = dx * dx + dy * dy
            if (d > bestD) {
              bestD = d
              best = v
            }
          }
          groupCx[gi] = px[best]
          groupCy[gi] = py[best]
        }

        // 影子层 DOM 跟着投影坐标走:直接写 transform,绕开 React 的每帧 reconcile
        for (let i = 0; i < spots.length; i++) {
          const el = spotRefs.current[i]
          if (!el) continue
          let ox: number
          let oy: number
          if (grouping) {
            if (groupVerts[i].length === 0) {
              el.style.display = 'none'
              continue
            }
            ox = groupCx[i]
            oy = groupCy[i]
          } else {
            const v = (spots[i] as WireframeHotspot).vertex
            if (v < 0 || v >= vertCount) {
              // 越界的热点连 Tab 顺序一起摘掉
              el.style.display = 'none'
              continue
            }
            ox = px[v]
            oy = py[v]
          }
          el.style.display = ''
          el.style.transform = `translate(${ox - half - HOTSPOT_SIZE / 2}px, ${
            oy - half - HOTSPOT_SIZE / 2
          }px)`
        }

        // 高亮的分区:悬停 / 键盘焦点 / 选中,焦点也算悬停,键鼠反馈一致
        const selectedGroup = grouping ? (selectedRef.current ?? -1) : -1
        const litGroup = grouping
          ? hoveredGroup >= 0
            ? hoveredGroup
            : focusedSpot
          : -1

        // 填充先铺,线条压在上面 —— 反过来会把整个线框糊掉
        if (litGroup >= 0 && litGroup !== selectedGroup) {
          fillGroup(litGroup, GROUP_HOVER_FILL)
        }
        fillGroup(selectedGroup, GROUP_SELECT_FILL)

        counts.fill(0)
        let hoverCount = 0
        let selectCount = 0
        for (let e = 0, p = 0; e < edgeCount; e++, p += 2) {
          const a = edges[p]
          const b = edges[p + 1]
          if (a >= vertCount || b >= vertCount) continue
          // 高亮的分区整片一个亮度,不参与深度分档 —— 选中就是要跳出来
          const gi = edgeGroup[e]
          if (gi >= 0 && gi === selectedGroup) {
            selectBucket[selectCount++] = e
            continue
          }
          if (gi >= 0 && gi === litGroup) {
            hoverBucket[hoverCount++] = e
            continue
          }
          // 归一化深度 t ∈ [-1, 1](-1 最近)线性映射到档位(0 最远)
          const t = (pz[a] + pz[b]) / 2
          const band = clamp(
            Math.floor(((1 - t) / 2) * DEPTH_ALPHA.length),
            0,
            DEPTH_ALPHA.length - 1,
          )
          buckets[band][counts[band]++] = e
        }

        ctx.lineWidth = 1
        ctx.lineCap = 'square'
        ctx.lineJoin = 'miter'
        for (let band = 0; band < buckets.length; band++) {
          const n = counts[band]
          if (n === 0) continue
          ctx.globalAlpha = DEPTH_ALPHA[band]
          // 最远一档退到钢蓝结构色,近处两档用 tone 色
          ctx.strokeStyle = lineColor
          ctx.beginPath()
          const list = buckets[band]
          for (let i = 0; i < n; i++) {
            const p = list[i] * 2
            const a = edges[p]
            const b = edges[p + 1]
            ctx.moveTo(px[a], py[a])
            ctx.lineTo(px[b], py[b])
          }
          ctx.stroke()
        }

        /** 整片区域一次描完,和深度桶一样每桶只 stroke 一次 */
        const strokeBucket = (list: Int32Array, n: number, alpha: number) => {
          if (n === 0) return
          ctx.globalAlpha = alpha
          ctx.strokeStyle = lineColor
          ctx.beginPath()
          for (let i = 0; i < n; i++) {
            const p = list[i] * 2
            const a = edges[p]
            const b = edges[p + 1]
            ctx.moveTo(px[a], py[a])
            ctx.lineTo(px[b], py[b])
          }
          ctx.stroke()
        }

        // 悬停在下、选中在上,两者重叠时选中赢
        strokeBucket(hoverBucket, hoverCount, GROUP_HOVER_ALPHA)
        strokeBucket(selectBucket, selectCount, 1)
        // 角标压在最上层
        strokeBrackets(selectedGroup)

        // 顶点模式的命中态:热点悬停 > 热点焦点 > canvas 命中。
        // 键盘聚焦和鼠标悬停画的是同一个东西,两种输入看到的反馈才一致
        if (!grouping) {
          const spot = hoveredSpot >= 0 ? hoveredSpot : focusedSpot
          const target =
            spot >= 0 && spot < spots.length
              ? (spots[spot] as WireframeHotspot).vertex
              : hovered
          // 实心方块,和"选中态反色实心"一致,不加辉光
          if (target >= 0 && target < vertCount) {
            ctx.globalAlpha = 1
            ctx.fillStyle = lineColor
            const hx = Math.round(px[target] - half)
            const hy = Math.round(py[target] - half)
            const s = HIT_SQUARE
            ctx.fillRect(hx - s / 2, hy - s / 2, s, s)
          }
        }
        ctx.globalAlpha = 1
        updateCursor()
      }

      let raf = 0
      let pending = 0
      let last = 0
      const rate = (speed * Math.PI) / 180

      const tick = (now: number) => {
        if (last === 0) last = now
        // 夹住 dt:标签页切回来时不要一次转过头
        const dt = Math.min(0.1, (now - last) / 1000)
        last = now
        // 拖拽期间交给用户,自转让位
        if (!dragging) yaw += rate * dt
        draw()
        raf = requestAnimationFrame(tick)
      }
      const start = () => {
        if (raf !== 0) return
        last = 0
        raf = requestAnimationFrame(tick)
      }
      const stop = () => {
        if (raf === 0) return
        cancelAnimationFrame(raf)
        raf = 0
      }
      /** 静态场景(speed=0 / reduced-motion)下由交互驱动的单帧重绘 */
      const requestFrame = () => {
        if (raf !== 0 || pending !== 0) return
        pending = requestAnimationFrame(() => {
          pending = 0
          draw()
        })
      }

      // 让 selected 变化能在静态场景下触发重绘,而不必把它塞进 deps 重建整条管线
      requestFrameRef.current = requestFrame

      // 先画一帧,保证静态场景(reduced-motion / speed=0)也有内容
      draw()

      const animated = speed !== 0 && !prefersReducedMotion()
      let io: IntersectionObserver | null = null
      if (animated) {
        if (typeof IntersectionObserver === 'undefined') {
          start()
        } else {
          io = new IntersectionObserver((entries) => {
            // 滚出视口就停 rAF,不白烧一整页看不见的帧
            if (entries.some(entry => entry.isIntersecting)) start()
            else stop()
          })
          io.observe(canvas)
        }
      }

      const localPos = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
      }

      const onPointerDown = (e: PointerEvent) => {
        if (!draggable) return
        dragging = true
        dragMoved = 0
        lastClientX = e.clientX
        lastClientY = e.clientY
        canvas.setPointerCapture?.(e.pointerId)
        updateCursor()
      }

      const onPointerMove = (e: PointerEvent) => {
        const p = localPos(e)
        pointerX = p.x
        pointerY = p.y
        pointerInside = true
        if (dragging) {
          const dx = e.clientX - lastClientX
          const dy = e.clientY - lastClientY
          lastClientX = e.clientX
          lastClientY = e.clientY
          dragMoved += Math.abs(dx) + Math.abs(dy)
          yaw += (dx * DRAG_YAW_PER_PX * Math.PI) / 180
          pitchDeg = clamp(
            pitchDeg + dy * DRAG_PITCH_PER_PX,
            -MAX_PITCH,
            MAX_PITCH,
          )
        }
        // 事件频率和 rAF 对不齐,这里只记坐标,命中与重绘都留给下一帧
        requestFrame()
      }

      const onPointerUp = (e: PointerEvent) => {
        const wasDragging = dragging
        if (dragging) {
          dragging = false
          if (canvas.hasPointerCapture?.(e.pointerId)) {
            canvas.releasePointerCapture(e.pointerId)
          }
        }
        // 拖过头的不算点击
        if (!wasDragging || dragMoved <= DRAG_SLOP) {
          const p = localPos(e)
          if (grouping) {
            const hit = pickGroupAt(p.x, p.y)
            onSelectRef.current?.(hit >= 0 ? hit : null)
          } else if (picking) {
            const hit = pickAt(p.x, p.y)
            onPickRef.current?.(hit >= 0 ? hit : null)
          }
        }
        // 光标不能等下一帧才还原,松手的反馈必须是立即的
        updateCursor()
        requestFrame()
      }

      const onPointerLeave = () => {
        pointerInside = false
        hovered = -1
        hoveredGroup = -1
        updateCursor()
        requestFrame()
      }

      const interactive = draggable || picking || grouping
      if (interactive) {
        canvas.addEventListener('pointerdown', onPointerDown)
        canvas.addEventListener('pointermove', onPointerMove)
        canvas.addEventListener('pointerup', onPointerUp)
        canvas.addEventListener('pointerleave', onPointerLeave)
        canvas.addEventListener('pointercancel', onPointerLeave)
        updateCursor()
      }

      // 热点:焦点与悬停都落到同一套高亮,Enter/Space 由 <button> 原生变成 click
      const spotCleanups: (() => void)[] = []
      for (let i = 0; i < spots.length; i++) {
        const el = spotRefs.current[i]
        if (!el) continue
        const onFocus = () => {
          focusedSpot = i
          requestFrame()
        }
        const onBlur = () => {
          focusedSpot = -1
          requestFrame()
        }
        const onEnter = () => {
          hoveredSpot = i
          requestFrame()
        }
        const onLeave = () => {
          hoveredSpot = -1
          requestFrame()
        }
        const onClick = () => {
          // 键盘激活和鼠标点击走同一条出口,粒度也一致
          if (grouping) onSelectRef.current?.(i)
          else onPickRef.current?.((spots[i] as WireframeHotspot).vertex)
        }
        el.addEventListener('focus', onFocus)
        el.addEventListener('blur', onBlur)
        el.addEventListener('pointerenter', onEnter)
        el.addEventListener('pointerleave', onLeave)
        el.addEventListener('click', onClick)
        spotCleanups.push(() => {
          el.removeEventListener('focus', onFocus)
          el.removeEventListener('blur', onBlur)
          el.removeEventListener('pointerenter', onEnter)
          el.removeEventListener('pointerleave', onLeave)
          el.removeEventListener('click', onClick)
        })
      }

      // 换 data-fui-theme 时重读 token,静态场景下顺手重画
      let mo: MutationObserver | null = null
      if (typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(() => {
          readPalette()
          if (!animated) requestFrame()
        })
        mo.observe(document.documentElement, {
          attributeFilter: ['data-fui-theme'],
        })
      }

      // 容器变宽要重设位图;动画中 draw 已每帧自查,这里主要救静态场景
      let ro: ResizeObserver | null = null
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          if (!animated) requestFrame()
        })
        ro.observe(canvas)
      }

      return () => {
        stop()
        requestFrameRef.current = null
        if (pending !== 0) cancelAnimationFrame(pending)
        if (interactive) {
          canvas.removeEventListener('pointerdown', onPointerDown)
          canvas.removeEventListener('pointermove', onPointerMove)
          canvas.removeEventListener('pointerup', onPointerUp)
          canvas.removeEventListener('pointerleave', onPointerLeave)
          canvas.removeEventListener('pointercancel', onPointerLeave)
        }
        for (const off of spotCleanups) off()
        io?.disconnect()
        mo?.disconnect()
        ro?.disconnect()
      }
    }, [
      model,
      tone,
      height,
      speed,
      pitch,
      zoom,
      quantize,
      perspective,
      draggable,
      picking,
      pickRadius,
      spots,
      groupList,
      grouping,
    ])

    return (
      <div
        ref={ref}
        // 有热点时根元素变成 group,语义由这些 button 承担;
        // role="img" 的子元素会被读屏当装饰忽略,热点就白做了
        role={spots.length > 0 ? 'group' : 'img'}
        aria-label={label}
        data-tone={tone}
        className={cn('relative w-full', className)}
      >
        <canvas
          ref={canvasRef}
          data-testid="fui-wireframe-canvas"
          aria-hidden={spots.length > 0 || undefined}
          className="block w-full"
          style={{
            height,
            // 不关掉的话触屏上按住拖会变成滚页面
            touchAction: draggable ? 'none' : undefined,
            filter: glow
              ? `drop-shadow(0 0 3px var(--fui-${tone}))`
              : undefined,
          }}
        />
        {spots.map((spot, i) => (
          <button
            key={`${spot.label}-${i}`}
            ref={(el) => {
              spotRefs.current[i] = el
            }}
            type="button"
            aria-label={spot.label}
            // 组模式下按钮承载选中态,读屏才知道哪片是选中的
            aria-pressed={grouping ? selected === i : undefined}
            data-testid="fui-wireframe-hotspot"
            // 位置由渲染循环写 transform,这里只管尺寸和焦点样式
            className="absolute top-0 left-0 h-4 w-4 focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--fui-primary)]"
          />
        ))}
      </div>
    )
  },
)

Wireframe.displayName = 'Wireframe'
