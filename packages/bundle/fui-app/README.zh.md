# `@deepseek-ai/dsh-fui-app`

[English](README.md) | 中文

FUI 界面组合包。[`cordis.patch.yml`](cordis.patch.yml) 叠加在 [`dsh-web-app`](../web-app/README.md) 上，后者又叠加在 [`dsh-base`](../base/README.md) 上；本包会把浏览器花名册中的展示配置项替换为 f-ui 对应实现。`fui` profile 按该顺序组合这三个包。

## 为什么叠加在 dsh-web-app 上，而不是 fork

FUI 界面与原 Web 界面的差异在于浏览器花名册挂载了哪些客户端 plugin，而不在于页面如何提供。Web 服务器、API 网关、浏览器信任围栏和已构建前端 dist 的解析方式完全相同，因此本包不会重复声明这些配置项，而是直接继承它们。

这带来一项直接收益：`dsh web` 与 `dsh --profile fui` 能保持并行运行并共用同一份前端构建。在界面开发期间，可以并排启动两种界面，直接比较 token 映射是否降低了原界面的可读性。

这种组合也缩小了 fork 对上游的影响。独立界面需要自己的运行时胶水，因为前端 dist 位置有意不提供配置项：`dsh-web-app` 通过前端包的 exports 解析它，并把它定义为该组合包拥有的 Workspace 知识，而不是用户配置。为了修改一个路径而复制这段胶水，会 fork 约 185 行代码，并让副本在上游演进时静默漂移。

## 上游接入点

组合本包需要在包外增加两项单行改动：

- [`app-boot`](../../boot/app-boot/README.md#profiles) 中的 `PROFILE_TEMPLATES` 增加 `fui` 配置项，使 `dsh --profile fui` 能像 `web` 与 `headless` 一样自动初始化，而不需要执行 `dsh plugin` init。
- `dsh` CLI 应用依赖本包，因为 profile 组合包通过该应用依赖闭包构建的扁平模块回退机制解析。

## 模型体验

### FUI 界面 persona

#### 模型看到的内容

本层重新声明的 persona 在原 coding agent（编程智能体）persona 后增加一句，说明模型所在 GUI 使用的视觉系统。这样，当用户询问当前界面时，模型不会使用原界面的描述。`{{model}}` 与 `{{cwd}}` 是系统提示配置项已经拥有的原有替换值；本层只增加末尾一句。

##### Persona 原文

```markdown
You are a coding agent powered by the {{model}} model. Your working directory is {{cwd}}. The GUI you are surfaced through uses the FUI visual system: a dark navy ground with thin steel-blue rules and teal highlights.
```

#### Token 影响

系统提示新增一句话，每个 Session 内保持不变。

#### KV Cache 影响

Persona 位于系统提示的稳定头部，在进程生命周期内不会变化，因此不会跨轮次使缓存失效。

## 已知限制与暂缓事项

- **与 `dsh-web-app` 共用一份前端构建**：两种界面加载同一个 dist，因此应用层改动，例如 Tailwind utility 构建，也会进入原界面。只有花名册及其主题不同。
- **功能包保持共用**：花名册会替换界面声明和应用布局，而对话、侧栏、Workspace、设置与工具卡片包在两个 profile 中共用。它们的 FUI 规则只在 `body[data-fui-surface]` 下激活。
- **没有组合测试断言层级顺序**：FUI 配置项是否覆盖 Web 配置项通过读取 `--dump-config` 验证，而不是由门禁保证。
