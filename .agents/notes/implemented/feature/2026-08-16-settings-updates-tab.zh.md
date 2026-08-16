# Agent Note: Settings Updates tab for the official DSH runtime

Status: implemented

[English](2026-08-16-settings-updates-tab.md) | 中文

## Problem

桌面运行时更新器之前只是通用设置页里一个信息密集的「桌面运行时」区块：三行版本/范围信息加一个「检查并更新」按钮，检查和安装合成一步——只想看看有没有更新的用户也会触发安装。区块里的细节（FUI 版本、兼容范围）挤在通用页里，却不回答任何高频问题。

## Decision

设置新增仅限桌面端的**更新**区块（`id: 'updates'`，order 30），由 `dsh-client-ui-settings-runtime-updater` 通过现有 `settings.section` slot 贡献；通用设置页里的旧行移除。新区块刻意精简：当前版本（含应用内置/已更新来源）、最新版本、一个**检查更新**按钮。仅当检查发现更新且兼容时才出现**立即更新**按钮；不兼容、失败、需重启等状态以一行提示呈现。

Host 网关（`packages/host/runtime-updater`）把检查 half 从一键更新中拆出：新增只查询的 `@Remote('check')`，复用与 `update` 共享的 registry 抓取逻辑，返回 `{ currentVersion, latestVersion, updateAvailable, compatible }`，不触碰文件系统、不占串行安装槽位。`describe` 保持无网络，用于首屏渲染。

FUI 自更新明确不在范围内：macOS 桌面构建未签名（Squirrel/electron-updater 要求签名），且 FUI overlay 包未发布到 npm，应用持有的 FUI 版本只能随桌面版本发布而更新。因此该区块只展示 DSH 信息。

## Alternatives considered

- **通用页保留区块、新 tab 作为第二入口**：否决——一个更新流程两个归属，且通用页的明细行正是要消除的冗余。
- **只保留检查并安装一步按钮**（旧行为）：否决——检查必须是无副作用的；安装应是单独的、知情的点击。
- **扩展 updater 从 npm 拉取 FUI overlay 包**：暂不采用——overlay 包尚未发布，该通道无法端到端验证；等 FUI 发版流程发布后可在 overlay 来源上扩展。
- **用 electron-updater 对接 GitHub Releases**：否决——macOS 自更新要求签名证书，而本仓库没有；在主力平台上它会无声地哪里都不可用。

## Consequences

- 检查是只读操作，与安装分离；最新版本行按需填充。
- Remote 面新增一个方法（`runtimeUpdater/check`）；生成的 remote 客户端随正常构建重建。
- 通用设置页失去桌面运行时区块；bundle 的 desktop-only `disabled` 门控不变，浏览器里的 `dsh --profile fui` 永远看不到这个 tab。
- 安装的运行时仍需完全重启桌面应用生效；没有程序化重启通道（不存在 IPC），文案如实说明。

## Testing

Host 测试覆盖新 Remote 的有更新/已最新/不兼容/失败各形态，并断言检查不启动任何子进程。Client 测试覆盖区块的各渲染状态（未检查、已检查、可更新、不兼容、已安装、每种失败码）与卸载取消，browser-plugin 测试固定 `settings.section` 注册、本地化标签和传输错误的包装。keyless 的桌面组合 e2e（`apps/web/tests/desktop-plugin-installation.e2e.ts`）在真实外壳中进入更新 tab，其 golden 固定了精简内容：当前版本、未检查的最新版本行和检查按钮，且挂载时不发起 registry 请求。
