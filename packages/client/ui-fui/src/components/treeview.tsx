import {
  Fragment,
  forwardRef,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { cn } from '../lib/cn.ts'

export interface TreeviewNode {
  value: string
  label: string
  children?: TreeviewNode[]
  disabled?: boolean
}

export interface TreeviewSingleProps {
  selectionMode?: 'single'
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
}

export interface TreeviewMultipleProps {
  selectionMode: 'multiple'
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
  /** 级联:切换父节点时所有后代跟随;父节点部分选中时显示半选态。默认 false */
  cascade?: boolean
}

export type TreeviewProps = {
  items: TreeviewNode[]
  /** 是否可选中,默认 false(纯展示 + 展开/折叠);为 false 时选中相关 prop 全部忽略 */
  selectable?: boolean
  /** 展开:仅非受控,defaultExpandedValues 指定初始展开的节点 value */
  defaultExpandedValues?: string[]
  /** 展开状态变化回调 */
  onExpandedChange?: (expandedValues: string[]) => void
  className?: string
} & (TreeviewSingleProps | TreeviewMultipleProps)

/** 拍平后的可见行:祖先全部展开的节点才进入列表 */
interface FlatRow {
  node: TreeviewNode
  depth: number
  parentValue: string | null
  hasChildren: boolean
  expanded: boolean
}

/** 按展开状态把树拍平成可见行数组,渲染与键盘导航共用 */
function flattenVisible(
  items: TreeviewNode[],
  expanded: Set<string>,
): FlatRow[] {
  const rows: FlatRow[] = []
  const walk = (
    nodes: TreeviewNode[],
    depth: number,
    parentValue: string | null,
  ) => {
    for (const node of nodes) {
      const hasChildren = (node.children?.length ?? 0) > 0
      const isExpanded = hasChildren && expanded.has(node.value)
      rows.push({
        node,
        depth,
        parentValue,
        hasChildren,
        expanded: isExpanded,
      })
      if (isExpanded && node.children)
        walk(node.children, depth + 1, node.value)
    }
  }
  walk(items, 0, null)
  return rows
}

/** 收集节点的全部后代 value(不含自身) */
function collectDescendants(node: TreeviewNode): string[] {
  const out: string[] = []
  const walk = (current: TreeviewNode) => {
    for (const child of current.children ?? []) {
      out.push(child.value)
      walk(child)
    }
  }
  walk(node)
  return out
}

/**
 * FUI 风格树形视图:方角薄边面板,只渲染可见节点,按层级缩进。
 * 默认不可选中(selectable=false):行纯展示,点击父节点行只切换展开。
 * selectable 时展开与选中解耦:行首 ▸ 箭头是独立的可点击元素,只负责
 * 展开/折叠;点击行本体只做选中。单选:选中行 primary 字 + ◆,重复点击不取消。
 * 多选(selectionMode='multiple'):行首方形复选框,aria-checked 标记;
 * cascade 时切换父节点所有后代跟随,父节点按后代推导全选/半选(mixed)/未选,
 * value 只存显式选中的节点(半选父节点不进 value)。
 * 键盘(roving tabindex):ArrowUp/Down 移动焦点,ArrowRight 展开/进子节点,
 * ArrowLeft 收起/回父节点,Enter/Space 选中(仅 selectable),Home/End 跳首末行。
 */
export const Treeview = forwardRef<HTMLDivElement, TreeviewProps>(
  (props, ref) => {
    const {
      items,
      selectable = false,
      defaultExpandedValues,
      onExpandedChange,
      className,
    } = props
    const multiple = props.selectionMode === 'multiple'
    const cascade = multiple ? (props.cascade ?? false) : false

    // 按 selectionMode 判别联合窄化,后续取值无需 as 强转
    const single = props.selectionMode === 'multiple' ? undefined : props
    const multi = props.selectionMode === 'multiple' ? props : undefined

    const isControlled = props.value !== undefined
    const [innerSingle, setInnerSingle] = useState<string | undefined>(
      typeof props.defaultValue === 'string' ? props.defaultValue : undefined,
    )
    const [innerMulti, setInnerMulti] = useState<string[]>(
      Array.isArray(props.defaultValue) ? props.defaultValue : [],
    )
    const currentSingle = single
      ? isControlled
        ? single.value
        : innerSingle
      : undefined
    const currentMulti =
      (multi && isControlled ? multi.value : innerMulti) ?? []
    const checkedSet = new Set(currentMulti)

    const [expandedValues, setExpandedValues] = useState<string[]>(
      defaultExpandedValues ?? [],
    )
    const expandedSet = new Set(expandedValues)
    const rows = flattenVisible(items, expandedSet)

    // 全树的 value → 父 value 映射(cascade 取消选中时清理祖先用)
    const parentMap = new Map<string, string>()
    const buildParentMap = (nodes: TreeviewNode[], parent: string | null) => {
      for (const node of nodes) {
        if (parent !== null) parentMap.set(node.value, parent)
        buildParentMap(node.children ?? [], node.value)
      }
    }
    buildParentMap(items, null)

    // roving tabindex:当前聚焦行;初始为可见的选中行,否则第一个可见行
    const [focusValue, setFocusValue] = useState<string | undefined>(() => {
      const initialRows = flattenVisible(
        items,
        new Set(defaultExpandedValues ?? []),
      )
      const selected = initialRows.find(
        row => row.node.value === currentSingle,
      )
      return (selected ?? initialRows[0])?.node.value
    })
    const rowRefs = useRef(new Map<string, HTMLButtonElement>())

    if (items.length === 0) return null

    const activeValue =
      focusValue && rows.some(row => row.node.value === focusValue)
        ? focusValue
        : rows[0]?.node.value

    const setExpanded = (next: string[]) => {
      setExpandedValues(next)
      onExpandedChange?.(next)
    }

    const toggleExpand = (nodeValue: string) => {
      setExpanded(
        expandedSet.has(nodeValue)
          ? expandedValues.filter(v => v !== nodeValue)
          : [...expandedValues, nodeValue],
      )
    }

    const select = (nodeValue: string) => {
      if (!isControlled) setInnerSingle(nodeValue)
      single?.onValueChange?.(nodeValue)
    }

    /** 多选(含 cascade)下节点的显示状态 */
    const checkState = (
      node: TreeviewNode,
    ): 'checked' | 'mixed' | 'unchecked' => {
      if (!cascade || (node.children?.length ?? 0) === 0) {
        return checkedSet.has(node.value) ? 'checked' : 'unchecked'
      }
      const descendants = collectDescendants(node)
      const count = descendants.filter(v => checkedSet.has(v)).length
      if (count === 0) return 'unchecked'
      return count === descendants.length ? 'checked' : 'mixed'
    }

    const toggleCheck = (node: TreeviewNode) => {
      const next = new Set(checkedSet)
      if (cascade) {
        // 全选/半选 → 全选;已全选 → 全不选,并清理不再全选的祖先
        if (checkState(node) === 'checked') {
          for (const v of [node.value, ...collectDescendants(node)]) {
            next.delete(v)
          }
          let parent = parentMap.get(node.value)
          while (parent !== undefined) {
            next.delete(parent)
            parent = parentMap.get(parent)
          }
        } else {
          for (const v of [node.value, ...collectDescendants(node)]) {
            next.add(v)
          }
        }
      } else if (next.has(node.value)) {
        next.delete(node.value)
      } else {
        next.add(node.value)
      }
      const arr = [...next]
      if (!isControlled) setInnerMulti(arr)
      multi?.onValueChange?.(arr)
    }

    const focusRow = (nodeValue: string | undefined) => {
      if (nodeValue === undefined) return
      setFocusValue(nodeValue)
      rowRefs.current.get(nodeValue)?.focus()
    }

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (rows.length === 0) return
      const focusedIndex = rows.findIndex(
        row => rowRefs.current.get(row.node.value) === document.activeElement,
      )
      const index =
        focusedIndex >= 0
          ? focusedIndex
          : rows.findIndex(row => row.node.value === activeValue)
      const row = rows[index]
      if (!row) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (index < rows.length - 1) focusRow(rows[index + 1]?.node.value)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        if (index > 0) focusRow(rows[index - 1]?.node.value)
      } else if (event.key === 'Home') {
        event.preventDefault()
        focusRow(rows[0]?.node.value)
      } else if (event.key === 'End') {
        event.preventDefault()
        focusRow(rows[rows.length - 1]?.node.value)
      } else if (event.key === 'ArrowRight') {
        if (row.node.disabled) return
        event.preventDefault()
        if (!row.hasChildren) return
        if (!row.expanded) {
          toggleExpand(row.node.value)
        } else {
          // 已展开:DFS 拍平下第一个子节点紧跟父节点
          const child = rows[index + 1]
          if (child && child.parentValue === row.node.value) {
            focusRow(child.node.value)
          }
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (row.hasChildren && row.expanded && !row.node.disabled) {
          toggleExpand(row.node.value)
        } else if (row.parentValue !== null) {
          focusRow(row.parentValue)
        }
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        // Enter/Space 只做选中,不切换展开;不可选中模式下无操作
        if (!selectable || row.node.disabled) return
        if (multiple) toggleCheck(row.node)
        else select(row.node.value)
      }
    }

    // 渲染基于拍平结果:按 parentValue 分组,子节点包在 role="group" 里
    const byParent = new Map<string | null, FlatRow[]>()
    for (const row of rows) {
      const list = byParent.get(row.parentValue) ?? []
      list.push(row)
      byParent.set(row.parentValue, list)
    }

    const renderRow = (row: FlatRow) => {
      const selected =
        selectable && !multiple && row.node.value === currentSingle
      const state = selectable && multiple ? checkState(row.node) : undefined
      return (
        <button
          key={row.node.value}
          ref={(el) => {
            if (el) rowRefs.current.set(row.node.value, el)
            else rowRefs.current.delete(row.node.value)
          }}
          type="button"
          role="treeitem"
          aria-selected={selectable && !multiple ? selected : undefined}
          aria-checked={
            state === undefined
              ? undefined
              : state === 'mixed'
                ? 'mixed'
                : state === 'checked'
          }
          aria-expanded={row.hasChildren ? row.expanded : undefined}
          disabled={row.node.disabled}
          tabIndex={row.node.value === activeValue ? 0 : -1}
          style={{ paddingLeft: row.depth * 12 + 8 }}
          onClick={() => {
            setFocusValue(row.node.value)
            if (!selectable) {
              if (row.hasChildren) toggleExpand(row.node.value)
            } else if (multiple) {
              toggleCheck(row.node)
            } else {
              select(row.node.value)
            }
          }}
          className={cn(
            'flex h-7 w-full cursor-pointer items-center gap-1.5 pr-2 text-left text-[10px] uppercase leading-none tracking-[0.2em]',
            'transition-colors duration-150 motion-reduce:transition-none',
            'disabled:cursor-not-allowed disabled:opacity-40',
            selected
              ? 'text-[var(--fui-primary)]'
              : 'text-[var(--fui-text-dim)] hover:bg-[var(--fui-primary-soft)] hover:text-[var(--fui-text)]',
          )}
        >
          {row.hasChildren ? (
            <span
              role="button"
              aria-label="切换展开"
              tabIndex={-1}
              onClick={(event) => {
                event.stopPropagation()
                if (row.node.disabled) return
                setFocusValue(row.node.value)
                toggleExpand(row.node.value)
              }}
              className="flex w-1.5 shrink-0 cursor-pointer items-center justify-center text-[var(--fui-text-dim)]"
            >
              <span
                aria-hidden
                className={cn(
                  'transition-transform duration-150 motion-reduce:transition-none',
                  row.expanded && 'rotate-90',
                )}
              >
                ▸
              </span>
            </span>
          ) : (
            <span
              aria-hidden
              className="flex w-1.5 shrink-0 items-center justify-center"
            >
              <span className="h-1 w-1 border border-[var(--fui-line)]" />
            </span>
          )}
          {state !== undefined ? (
            <span
              aria-hidden
              className="flex h-3 w-3 shrink-0 items-center justify-center border border-[var(--fui-line)]"
            >
              {state === 'checked' ? (
                <span
                  className="h-1.5 w-1.5"
                  style={{ background: 'var(--fui-primary)' }}
                />
              ) : null}
              {state === 'mixed' ? (
                <span
                  className="h-0.5 w-1.5"
                  style={{ background: 'var(--fui-primary)' }}
                />
              ) : null}
            </span>
          ) : null}
          {selected ? <span aria-hidden>◆</span> : null}
          <span className="leading-none">{row.node.label}</span>
        </button>
      )
    }

    const renderGroup = (parentValue: string | null) =>
      (byParent.get(parentValue) ?? []).map(row => (
        <Fragment key={row.node.value}>
          {renderRow(row)}
          {row.expanded ? (
            <div role="group">{renderGroup(row.node.value)}</div>
          ) : null}
        </Fragment>
      ))

    return (
      <div
        ref={ref}
        role="tree"
        onKeyDown={onKeyDown}
        className={cn(
          'border border-[var(--fui-line)] bg-[var(--fui-panel-bg)] p-1',
          className,
        )}
      >
        {renderGroup(null)}
      </div>
    )
  },
)

Treeview.displayName = 'Treeview'
