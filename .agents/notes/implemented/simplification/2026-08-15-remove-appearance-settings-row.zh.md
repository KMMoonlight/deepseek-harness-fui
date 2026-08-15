# Agent Note: 移除「外观」设置行

Status: implemented

[English](2026-08-15-remove-appearance-settings-row.md) | 中文

## 问题

已交付的 FUI 界面只有一套固定的青色深色配色，产品设置却仍把「浅色」、「深色」与「跟随系统」作为三个可见选项。它们在 FUI 上都落到同一套配色，因此这一行承诺了实际无法交付的视觉变化，还在「通用」页占据了一大块矩形空间。

ThemeRuntime 仍承担与设置页无关的职责。它在启动期解析 Host 主题值，保留原界面的明暗语义，向布局呈现器发布快照，并支持已注册的 token 覆盖与扩展消费方。如果连这些运行时职责也与误导性的设置行一起删除，会破坏它们各自的用途。

## 决策

ui-theme 不再向 `settings.general.item` 注册 `appearance` contribution。该包删除专为这一 contribution 存在的行组件、行 store、图标、本地化文案、CSS、测试、React 依赖，以及 slot／locale 依赖。产品设置不再显示「外观」标签或「浅色」、「深色」、「跟随系统」控件。

ThemeRuntime、`ui-theme.preference` Host schema、启动注入、`ThemeSnapshot`、`setTheme`、token 注册表与布局呈现器保留。现有持久化值仍会被采纳，程序化消费方也仍可写入内置偏好，但第一方设置界面不提供写入路径。[Host settings 支撑的偏好决策](../bug-fix/2026-08-06-host-backed-web-preferences.md)继续拥有持久化职责，本 Note 则取代[Client Settings 提案](../../proposed/architecture/2026-07-25-client-settings-locale-theme.md)中的「外观」设置行部分。

## 验证

组装后的 Settings 场景会断言「外观」标签与三个控件均不存在，并记录变更后「通用」页的无障碍快照。组装后的 FUI 界面场景会独立断言英文选择器不存在。ui-theme 单元测试仍覆盖立即提供服务、采纳 Host 偏好、重连刷新、远程端内存模式、缓慢初始读取与无效 wire 值。生成的客户端 slot 目录中，`settings.general.item` 下不再有 ui-theme occupant。

## 曾考虑的替代方案

**只用 FUI CSS 隐藏该行。** 未采用，因为 contribution 与其无障碍控件仍会存在，slot ledger 也会保留一个幽灵 occupant，非 FUI 产品入口还会继续宣称产品支持这一选择。

**删除 ThemeRuntime 与全部主题设置。** 未采用，因为启动引导、原界面语义、布局呈现、token 检查与扩展消费方都是与产品设置行无关的现行约定。

**把选择器移入可选插件。** 未采用，因为已交付的产品界面没有为该选择器提供差异化配色。一个休眠的包只会保留代码与依赖，却不交付用户可见的能力。

## 后果

「通用」页变得更短，只显示能产生可观察结果的设置。Host 中已存储的主题值仍可能影响原界面与启动行为，但用户无法通过产品设置更改它。重新引入面向用户的主题选择器，至少要先交付两套真正不同的配色，再提供归功能属主所有的设置 contribution 与组装后交互测试。
