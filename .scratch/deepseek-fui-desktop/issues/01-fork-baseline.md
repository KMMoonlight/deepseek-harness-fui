# 01 — Fork 基线跑通

**What to build:** 把 deepseek-harness fork 成本项目的主干，并确认在本机能完整构建与运行。完成后开发者能在浏览器里打开一个可正常对话的官方 dsh Web UI —— 这是后续所有改造的对照基线，也是判断"是我改坏了还是上游本来就这样"的唯一依据。

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] 仓库内容来自 deepseek-harness，且配置了指向上游的 remote，可拉取上游更新
- [ ] 依赖安装与完整构建通过（注意构建阶段有严格顺序要求，host 契约生成早于 client 编译）
- [ ] 官方 web profile 能启动，浏览器可访问并完成至少一轮包含工具调用的完整对话
- [ ] 官方 web profile 的组装树 dump 已存档在仓库内，供后续 patch 比对
- [ ] 首次 commit 落地
