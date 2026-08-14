# 01 — Fork 基线跑通

**What to build:** 把 deepseek-harness fork 成本项目的主干，并确认在本机能完整构建与运行。完成后开发者能在浏览器里打开一个可正常对话的官方 dsh Web UI —— 这是后续所有改造的对照基线，也是判断"是我改坏了还是上游本来就这样"的唯一依据。

**Blocked by:** None — can start immediately

**Status:** 除一条验收外全部完成

- [x] 仓库内容来自 deepseek-harness（`main` @ `47f9438`），`upstream` remote 已配置
- [x] 依赖安装与完整构建通过（`pnpm install` 3m12s，`pnpm run build` 全绿）
- [x] 官方 web profile 能启动，浏览器可访问 —— 界面完整渲染（侧栏 / 工作区 / 输入区 / 模型选择）
- [ ] **完成至少一轮包含工具调用的完整对话** —— 待用户确认后执行，见下方说明
- [x] 官方 web profile 的组装树 dump 已存档（`../baselines/web-profile-dump.yml`，490 行，每行标注来源 bundle）
- [x] 首次 commit 落地（`f7c85de`，分支 `chore/fork-baseline`）

## 环境前置（已解决，未新装任何运行时）

上游要求 node `^22.19.0 || >=24.0.0` 与 pnpm 11.7.0；本机默认为 node 22.13.0 / pnpm 9.9.0，均不满足。
nvm 中已存在 v22.21.1，直接选用；pnpm 走 corepack 由 `packageManager` 字段决定。固化在 `../env.sh`。

慢速链路上首次安装会因大体积二进制包（playwright / node-pty / codex）超时失败，
需要 `--fetch-timeout=900000 --network-concurrency=3`。

## 未完成项说明

最后一条验收需要真实模型调用。本机 `~/.dsh` 已存在配置与历史会话，凭据看起来是齐的，
但执行它会消耗用户的 API 额度、并在用户真实的会话库中新建一条会话，因此留给用户确认后再跑。
