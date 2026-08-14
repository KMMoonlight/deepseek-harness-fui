# 01 — Fork 基线跑通

**What to build:** 把 deepseek-harness fork 成本项目的主干，并确认在本机能完整构建与运行。完成后开发者能在浏览器里打开一个可正常对话的官方 dsh Web UI —— 这是后续所有改造的对照基线，也是判断"是我改坏了还是上游本来就这样"的唯一依据。

**Blocked by:** None — can start immediately

**Status:** done

- [x] 仓库内容来自 deepseek-harness（`main` @ `47f9438`），`upstream` remote 已配置
- [x] 依赖安装与完整构建通过（`pnpm install` 3m12s，`pnpm run build` 全绿）
- [x] 官方 web profile 能启动，浏览器可访问 —— 界面完整渲染（侧栏 / 工作区 / 输入区 / 模型选择）
- [x] **完成至少一轮包含工具调用的完整对话** —— 通过 Web UI 实测：上下文注入 → Think → Bash 工具调用 → Think → 回答，1 轮 2 步，缓存命中 50%，会话标题自动生成
- [x] 官方 web profile 的组装树 dump 已存档（`../baselines/web-profile-dump.yml`，490 行，每行标注来源 bundle）
- [x] 首次 commit 落地（`f7c85de`，分支 `chore/fork-baseline`）

## 环境前置（已解决，未新装任何运行时）

上游要求 node `^22.19.0 || >=24.0.0` 与 pnpm 11.7.0；本机默认为 node 22.13.0 / pnpm 9.9.0，均不满足。
nvm 中已存在 v22.21.1，直接选用；pnpm 走 corepack 由 `packageManager` 字段决定。固化在 `../env.sh`。

慢速链路上首次安装会因大体积二进制包（playwright / node-pty / codex）超时失败，
需要 `--fetch-timeout=900000 --network-concurrency=3`。

## 对话验收的执行方式

用的是用户既有的 `~/.dsh`（凭据在其中），提示词为只读的 `pwd`，在既有工作区内执行。
代价是用户的会话库里多了一条测试会话，可自行删除。

后续工单起自有 profile 时应当指定独立的 `DSH_HOME`，把开发会话与日常使用隔开；
届时需要一并解决凭据来源（独立 home 不继承 `~/.dsh` 的凭据）。
