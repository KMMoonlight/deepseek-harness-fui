# @deepseek-ai/dsh-client-ui-settings-runtime-updater

[English](README.md) | 中文

该包是仅限桌面端的官方 DSH 受管更新「更新」设置页贡献项。plugin 通过通用 API Gateway 挂载生成的 `runtimeUpdater` Remote，等待 `settings.section`，再注册 `updates` 区块。由应用覆盖层独立持有这项贡献，可以在不替换官方 DSH 其他 Remote 贡献的情况下增加更新协议。挂载时只读取当前官方 DSH 版本，不访问网络；**检查更新**调用只查询的 `check` Remote（最新版本、是否有更新、是否兼容），**立即更新**才发起完整的检查与安装 `update` 请求。本地组件状态负责呈现加载、忙碌、兼容更新、不兼容、失败和需要重启等状态。卸载组件会取消正在执行的 Remote 请求并撤回贡献。

renderer 无法选择包、registry、tag、目标目录、pnpm 入口或命令参数。它只能接收版本信息和稳定的 Host 结果。不兼容的 npm 版本会显示但不会安装；Host 说明或有界子进程诊断收纳在可展开区域中。

## 模型体验

无。该包只渲染桌面设置，不注册任何模型可见输入。

#### KV Cache 影响

无；该设置行不会组装或发送 provider 请求。

## 已知限制与暂缓事项

- 该设置行只出现在桌面 FUI 组合中；普通 Web 与非桌面 `fui` 启动都不会挂载更新器的 Host 或 Client 端。
- 如果官方 DSH 版本超出应用声明的兼容范围，界面仍会显示该版本，但当前桌面版本不能安装它。
- 安装成功后，用户必须完全退出并重新打开桌面应用。
