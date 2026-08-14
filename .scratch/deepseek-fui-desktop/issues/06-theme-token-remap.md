# 06 — ui-theme token 重映射

**What to build:** 把 dsh 主题包的语义别名重新指向 fui 的设计 token，使保留下来的三十多个官方组件（对话、轨迹、工具卡片、侧栏、设置）整体呈现 FUI 风格 —— 而**不修改任何 feature 包**。

这一步是整个项目的可行性验证点，成本极低但杠杆极高。之所以可行：上游把主题包定义为语义别名层的唯一所有者，并禁止 feature 包写字面色值；f-ui 那侧同样把颜色全收进 CSS 变量并用测试逐文件强制。两边都是纯变量体系且前缀不冲突，所以改一个包就能换掉全局皮肤。

如果这一票做完发现官方组件的视觉密度和 FUI 风格根本不搭，那要尽早知道 —— 它会反过来影响后续要保留多少官方组件。

**Blocked by:** 05

**Status:** done

- [x] 语义别名映射到 fui token，覆盖表面、描边、文本、强调、状态五类角色 —— 且有测试强制**全量覆盖**
- [x] 侧栏、输入区、会话列表在新配色下可读；正文对比度实测 **11.5–12.1:1**，远超 WCAG AA 的 4.5:1
- [x] 未修改任何 feature 组件包，也未修改上游 `ui-theme`
- [x] 明暗处理已明确：fui 只有单一深色主题，FUI surface 上明暗两支落到同一套配色
- [x] ~~fui 多主题切换~~ 上游 v1 只实装 `cyan`，无第二套可切
- [x] 视觉评估：官方组件与 FUI 风格契合良好，无需缩小保留范围

## 实现方式：不改上游主题包，改用属性作用域的桥接表

按工单 04 的连带结论，就地改 `ui-theme` 会连带改掉 `dsh web`（两个 surface 共用一份产物）。
改为新增 `@deepseek-ai/dsh-client-ui-fui-surface`：一张作用域为 `body[data-fui-surface]` 的桥接表，
把 `--dsw-*` 重新指向 `--fui-*`；插件本身只负责在 FUI roster 下打开那个属性。
样式表对两个 surface 都下发，但只有带属性的那个会解析它。

## 关键发现：token 有两个家族，漏一个就翻车

原以为只有 `--dsw-alias-*`（77 个）。映射完之后**侧栏和输入框仍然是白的** —— 因为还存在
`--dsw-specific-*` 家族（11 个，命名具体表面：sidebar-fill、input-major、menu、bubble…），
它们直接解析到浅色静态标度。

这类遗漏的坏处是**不打开对应界面就看不见**，所以补完之后写了 [coverage spec](../../../packages/client/ui-fui-surface/tests/bridge-coverage.client.spec.ts)
把它变成 gate：任何 ui-theme 定义了而桥接表没重述的 token、任何 ui-theme 已删除而桥接表还留着的条目、
任何没有解析到 `--fui-*` 的映射，都会让构建失败。这条原本写在 README 里的"覆盖率无强制"限制现在不成立了。

## 遗留

- **mask 四个角色是字面量** —— 需要在 FUI 底色上叠 alpha，而 fui 没有预derive 的 mask 色阶，
  只能按已知底色写 `rgba()`。底色一改会静默失配（已在 spec 中列为唯一豁免）。
- **无对比度 gate** —— 数值是在运行界面上实测的，但没有逐角色断言，未来改 token 可能静默劣化可读性。
