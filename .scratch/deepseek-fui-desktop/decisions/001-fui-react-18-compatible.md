# 001 — f-ui 组件与 React 18 完全兼容，宿主不升级

**日期:** 2026-08-14
**关联工单:** 02
**状态:** 已确认

## 结论

f-ui 的全部 38 个组件在 dsh 当前的 React 18 上**原样可用，零改动**。宿主的 React 版本保持不变，不启动 React 19 升级序列。

## 背景

f-ui 的 `package.json` 声明 `react: ^19.2.8`，而 dsh 的 Web 应用锁 `react: ^18.2.0` / `@types/react: ~18.3.1`。声明上的版本差看起来是个阻塞项，需要判定它是真约束还是仅仅是 f-ui 自身开发环境的版本。

## 依据

扫描对象为 f-ui `main` 分支（`54efcd7`）源码树中的组件实现文件，排除 `*.stories.tsx` 与 `*.test.tsx`，共 38 个。

**React 19 独有 API 命中数全部为零：** `use()`、`useActionState`、`useOptimistic`、`useFormStatus`、`React.cache`、带 initialValue 的 `useDeferredValue`。

**无 `<Context>` 直接作为 Provider 的 19 语法。无 react-dom 导入。无组件内文档元数据元素**（19 的 metadata hoisting 特性未被使用）。

**ref 处理全部走 `forwardRef`：** 38/38 文件使用 `forwardRef`，没有任何组件依赖 React 19 的 ref-as-prop。

唯一一处 `ref?:` 出现在 `table.tsx` 的导出处：

```ts
export const Table = forwardRef(TableInner) as <T>(
  props: TableProps<T> & { ref?: Ref<HTMLDivElement> },
) => ReactElement;
```

这是泛型组件配合 `forwardRef` 的标准写法 —— `forwardRef` 会丢掉泛型参数，所以把结果 cast 成一个显式声明 `ref` 的泛型函数类型。运行时仍然经过 `forwardRef`，与 React 19 的 ref-as-prop 无关，在 React 18 下类型和行为都正确。

**组件从 `react` 导入的符号全集**（这是最有力的证据，因为它穷举了整个 React 表面）：

> 类型 — `ButtonHTMLAttributes`、`CSSProperties`、`Fragment`、`InputHTMLAttributes`、`KeyboardEvent`、`LabelHTMLAttributes`、`ReactElement`、`ReactNode`、`Ref`、`TextareaHTMLAttributes`
>
> 运行时 — `forwardRef`、`useEffect`、`useId`、`useRef`、`useState`

其中最"新"的是 `useId`，React 18.0 即已提供。全集落在 React 18 之内。

## 方法说明

扫描在本地源码树上进行。**不要用代码托管平台的搜索接口做这项判定** —— 对该仓库搜索 `forwardRef` 返回 0 命中，而实际 38 个文件全部在用，其搜索索引不可信。

## 影响

- 工单 03 及其后续可假定宿主 React 版本不变，不需要 expand–contract 升级序列
- f-ui 落盘后其 `package.json` 声明的 React 19 依赖**不要**带进 workspace；组件按源码引入，peer 由宿主提供
- 若日后 f-ui 上游引入 React 19 独有 API，同步组件时需重跑本扫描

## 附注

f-ui README 徽章写的是 37 个组件，实际实现文件与 registry item 均为 38 个。徽章滞后，不影响结论。
