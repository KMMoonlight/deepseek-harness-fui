# Agent Note: Desktop icon set generated from the FUI whale mark

Status: implemented

[English](2026-08-16-desktop-crt-whale-icons.md) | 中文

## Problem

桌面应用一直带着占位 `resources/icon.png`（一个绿色方框轮廓），打包产物没有产品标识，开发模式下 Dock 显示的是 Electron 自己的图标——从未有人调用 `app.dock.setIcon`。同一个占位图还喂给了托盘：压到 18px 再转成 macOS 模板图后，那圈细线在菜单栏上看起来像一片空白。

## Decision

`apps/desktop/scripts/build-icons.ts` 从 FishLogo 鲸鱼路径生成整套图标——路径在运行时从 ui-primitives 源码中提取，图样始终跟随产品标志。应用图标把鲸鱼轮廓画成 FUI 荧光绿描边，带辉光与扫描线，衬在深海军蓝圆角底板上（CRT 线条处理）；托盘图标用实心剪影——macOS 上是带 retina 表示的黑色模板图，Windows/Linux 上没有模板反色机制，用 FUI 绿。无头 Chromium（Playwright）负责栅格化 SVG；PNG 提交在 `resources/` 下、按需重渲，仓库不需要二进制编辑器，产物仍是可审查的图片。主进程里，`resourcePath()` 统一暂存资源查找，`trayImage()` 挂上 `@2x` 表示并设置模板标志，`boot()` 把 macOS Dock 指向该图标，开发运行也带产品图标。打包把 `resources/*.png` 全部暂存进 `desktop-resources/`。

## Alternatives considered

- **手绘二进制图标**：否决——diff 不可审查，且图样会偏离 FishLogo 这个唯一事实源。
- **托盘复用应用图标**：否决——1024px 的描边插画压到 18px 会丢光线条；macOS 托盘图必须是模板剪影，才能同时适配明暗菜单栏。
- **提交 `.icns`**：暂缓——electron-builder 会为 macOS/Windows 目标转换这张 1024px PNG；在当前保真度下，签入 icns 只是多一个二进制，没有收益。

## Consequences

- `resources/` 现在持有 `icon.png`（1024²）以及彩色、模板两对托盘图；`pnpm --filter @deepseek-ai/dsh-desktop run build:icons` 确定性重生成全部五张。
- `apps/desktop` 新增 Playwright devDependency（与 `apps/web` 同规格）供生成器使用；运行时不加载它。
- 开发模式的 macOS 窗口在 Dock 显示 FUI 图标；打包行为除换成真实图样外不变。

## Testing

桌面打包契约测试原样通过；typecheck 与桌面构建覆盖主进程改动。生成的 PNG 通过回读渲染结果验证；生成器是确定性的，重复运行不产生 diff。
