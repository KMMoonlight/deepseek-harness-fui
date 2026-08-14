import { forwardRef, type ReactElement, type ReactNode, type Ref } from 'react'
import { cn } from '../lib/cn.ts'

export interface TableColumn<T> {
  /** 对应 row 的字段名 */
  key: keyof T & string
  /** 表头文字,渲染为大写宽字距小字 */
  title: string
  /** 右对齐(金额/数值列),默认 left */
  align?: 'left' | 'right'
  /** 自定义单元格渲染,缺省渲染 row[key] */
  render?: (row: T) => ReactNode
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  data: T[]
  /** 行唯一键:字段名或函数 */
  rowKey: keyof T | ((row: T) => string)
  /** 传了行才可点击:hover 行 8% 青绿填充,cursor-pointer */
  onRowClick?: (row: T) => void
  /** data 为空时的占位文字,默认 'NO DATA' */
  emptyText?: string
  className?: string
}

/**
 * FUI 风格数据表格(纯展示):方角薄边外框,表头下 1px dashed 分隔线,
 * 行间 dashed 分隔;表头为大写宽字距 dim 小字,单元格为 text-xs。
 * 传 onRowClick 后行可点击:hover 行 8% 青绿填充、cursor-pointer。
 * 不做排序/分页,数值/金额列用 align="right" 右对齐。
 */
function TableInner<T>(
  {
    columns,
    data,
    rowKey,
    onRowClick,
    emptyText = 'NO DATA',
    className,
  }: TableProps<T>,
  ref: Ref<HTMLDivElement>,
) {
  const keyOf = (row: T): string =>
    typeof rowKey === 'function' ? rowKey(row) : String(row[rowKey])

  return (
    <div
      ref={ref}
      className={cn(
        'border border-[var(--fui-line)] bg-[var(--fui-panel-bg)]',
        className,
      )}
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-dashed border-[var(--fui-line)]">
            {columns.map(col => (
              <th
                key={col.key}
                className={cn(
                  'px-3 py-2 text-left text-[10px] font-normal uppercase leading-none tracking-[0.2em] text-[var(--fui-text-dim)]',
                  col.align === 'right' && 'text-right',
                )}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-6 text-center text-[10px] uppercase tracking-[0.2em] text-[var(--fui-text-dim)]"
              >
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, index) => (
              <tr
                key={keyOf(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  index > 0 &&
                    'border-t border-dashed border-[var(--fui-line)]',
                  onRowClick && [
                    'cursor-pointer',
                    'transition-colors duration-150 motion-reduce:transition-none',
                    'hover:bg-[var(--fui-primary-soft)]',
                  ],
                )}
              >
                {columns.map(col => (
                  <td
                    key={col.key}
                    className={cn(
                      'px-3 py-2 text-xs leading-none text-[var(--fui-text)]',
                      col.align === 'right' && 'text-right',
                    )}
                  >
                    {col.render ? col.render(row) : (row[col.key] as ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export const Table = forwardRef(TableInner) as <T>(
  props: TableProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;

(Table as { displayName?: string }).displayName = 'Table'
