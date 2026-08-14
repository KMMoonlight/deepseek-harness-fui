# 04 — 自有 profile 与前端应用

**What to build:** 建立本项目自己的 profile 和前端应用，让 dsh 启动时服务我们的前端而不是官方前端。此时视觉与功能都还与官方等价 —— 这一票的目的纯粹是打通组装链路：profile 如何叠 bundle、bundle 如何 patch 配置行、运行时如何解析到前端 dist。

把它和视觉改造分开，是为了在引入任何 FUI 元素之前先确认"换掉前端"这件事本身是通的。

**Blocked by:** 01

**Status:** done —— 实现方式与原设计有偏离，见下

- [x] ~~新增的前端应用能独立构建出 dist~~ **不再需要，见"设计偏离"**
- [x] 新增的 bundle 在官方 bundle 之上组合（`@deepseek-ai/dsh-fui-app` 叠在 `dsh-web-app` 之上）
- [x] 自有 profile 能启动，浏览器可访问（`dsh --profile fui --port 3098` 实测）
- [x] 该 profile 下功能与官方 web profile 等价 —— dump 逐行 diff 证明二者仅 persona 一行不同
- [x] 自有 profile 的组装树 dump 已存档（`../baselines/fui-profile-dump.yml`），与基线差异逐条可解释

## 设计偏离：不新建前端应用

原计划是复制 `apps/web` 成 `apps/fui`。实施时发现这条路成本远高于收益：

前端 dist 的位置**按设计不可配置** —— `dsh-web-app` 通过前端包的 exports 解析它，源码注释明确写着
"workspace knowledge of this bundle, never user config"，而且 `frontend-static` 是作为 web-runtime 的
子插件挂载的，不是独立配置行，没法按 id patch。要让另一个应用被服务，就得整份复制那 185 行 runtime glue，
而复制出来的副本会对着上游静默腐烂。

而前端应用本身只是 5 行 shell 引导 + Vite 配置，唯一需要改的是加 Tailwind 插件（工单 05 的事）。

**改为：`dsh-fui-app` 做纯 patch 层，两个 surface 共用一份前端产物。** 差异体现在 roster 挂哪些 client
插件上，而不是页面怎么被服务。三个额外好处：

1. `dsh web` 保持原样可用，可以和 `dsh --profile fui` 并排启动做 A/B 对照 —— 后面调 token 映射时这是最快的验证手段
2. 上游改动面从"复制 185 行"降到两行
3. webserver、API gateway、信任围栏这些全部继承，不会随上游演进而分叉

**连带影响工单 06：** 主题不能就地改上游的 `ui-theme`，否则 `dsh web` 也会跟着变色。应当新增独立的主题包，
由本 bundle 的 patch 把 roster 里的 `ui-theme` 行换掉。

## 上游改动（共两行 + 三处注册）

- `PROFILE_TEMPLATES` 加 `fui` 条目，使 `dsh --profile fui` 像 web/headless 一样自动初始化
- `apps/cli` 加本 bundle 依赖 —— profile 的 bundle 是通过 CLI 应用依赖闭包的符号链接农场解析的，不进这个闭包就找不到
- 另有三处机械注册：`tsconfig.host.json` references、约束 gate 的 `packageFileExtras`（发布 `cordis.patch.yml`）
