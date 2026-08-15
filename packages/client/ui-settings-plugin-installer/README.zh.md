# @deepseek-ai/dsh-client-ui-settings-plugin-installer

[English](README.md) | 中文

“插件”设置分区中仅用于桌面端的**安装插件**标签页。浏览器插件贡献一个 id 为 `install` 的本地化 `settings.plugins.tab` 条目；Web app bundle 会在非桌面 Host 中停用该行。插件激活时不会调用 Remote。提交一个包规格或 Git 规格后，组件才通过 [`api-remotes`](../../api/remotes/README.md) 调用 `pluginInstaller/add`；修改进行期间表单会停用，标签页卸载时则取消请求。

表单会提示已安装插件可以执行本机代码。Host 的稳定失败会转换成本地化消息，有长度上限的包管理器诊断保留在可展开区域中。成功状态会显示规范化后的规格，并提示用户重启 DeepSeek FUI；新对账得到的 profile layer 会在这次重启后进入 Loader 树。

## 模型体验

无，因为安装表单只会改变重启后使用的 profile，不会给模型请求或 Session 历史增加任何内容。

#### KV Cache 影响

无；打开或提交表单都不会改变模型输入。

## 已知限制与暂缓事项

- **需要重启** —— 成功后只能提示用户重启 DeepSeek FUI；该设置贡献无法在当前 Loader 树中激活新安装的包。
- **只提供最终诊断** —— Remote 运行期间表单显示忙碌状态，完成后再公开有长度上限的 stdout 与 stderr；它不会流式显示包管理器进度。
