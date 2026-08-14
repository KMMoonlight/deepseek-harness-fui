# 02 — fui 组件 React 18 兼容性判定

**What to build:** 判定 f-ui 的 37 个组件能否在 dsh 当前的 React 版本上原样运行。f-ui 声明 React 19，dsh 锁 React 18；但抽查显示 fui 组件用的是 `forwardRef` 这类经典写法，可能根本没碰 19 的独有能力。产出一个明确的书面结论，决定后续工单是"零改动直接用"还是"先把宿主升到 React 19"。

单独成票是因为这个结论会改变后面每一张票的形状，必须在动工前定下来。

**Blocked by:** 01

**Status:** done — 结论见 `../decisions/001-fui-react-18-compatible.md`

- [x] 全部 fui 组件已落盘到临时目录，数量与上游一致（38 个实现文件，与 registry item 数一致；README 徽章写 37 为滞后）
- [x] 已逐个检查 React 19 独有 API 的使用情况，含 ref 作为普通 prop 传递这一隐式用法（本地源码树扫描，未依赖代码托管平台搜索索引）
- [x] 结论写入决策记录 001，说明依据与抽样范围
- [x] 判定兼容：后续工单可假定宿主 React 版本不变
- [x] ~~不兼容分支~~ 未触发，无需 expand–contract 升级序列

**实际结论：** 38/38 组件使用 `forwardRef`，React 19 独有 API 零命中，从 `react` 导入的符号全集最新只到 `useId`（18.0 引入）。零改动可用。
