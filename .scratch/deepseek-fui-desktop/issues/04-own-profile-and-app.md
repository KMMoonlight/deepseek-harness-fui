# 04 — 自有 profile 与前端应用

**What to build:** 建立本项目自己的 profile 和前端应用，让 dsh 启动时服务我们的前端而不是官方前端。此时视觉与功能都还与官方等价 —— 这一票的目的纯粹是打通组装链路：profile 如何叠 bundle、bundle 如何 patch 配置行、运行时如何解析到前端 dist。

把它和视觉改造分开，是为了在引入任何 FUI 元素之前先确认"换掉前端"这件事本身是通的。

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 新增的前端应用能独立构建出 dist（结构对标官方 web 应用，入口保持极薄）
- [ ] 新增的 bundle 在官方基础 bundle 之上组合，并将前端 dist 指向新应用
- [ ] 自有 profile 能启动，浏览器可访问
- [ ] 该 profile 下功能与官方 web profile 等价：完成一轮含工具调用的对话、会话列表与历史可用、审批弹窗可正常应答、设置面板可打开
- [ ] 自有 profile 的组装树 dump 已存档，与基线 dump 的差异逐条可解释
