# Agent Note: 打包桌面端的封闭式插件安装

Status: implemented

[English](2026-08-17-hermetic-desktop-plugin-installs.md) | 中文

## Problem

从打包的 DeepSeek FUI 桌面应用安装插件，必须能在没有任何开发工具链的机器上成功：没有 Node、没有 pnpm、没有 git、没有 Xcode Command Line Tools。[打包运行时决策](2026-08-15-electron-fui-desktop-runtime.md)已经备齐了零件——Electron 充当 Node 运行时、经 `DSH_PNPM_ENTRY` 转发内置 pnpm 入口——但安装 `dsh-better-sidebar` 时暴露了三个断点。pnpm 在 Electron 可执行文件下运行时，生命周期脚本的 PATH 上没有 `node` 和 `pnpm`，git 插件的 prepare 步骤因此以 `sh: pnpm: command not found` 失败。pnpm 11 默认 24 小时最小发布年龄会拒绝依赖闭包里含有一天内新发布包的插件，且它在 pnpm 升级后的虚拟存储迁移会交互式询问、直接终止非 TTY 的安装进程。pnpm 还会通过 `git ls-remote` 解析 `https://github.com/...` 规格，而全新 macOS 上的 `/usr/bin/git` 只是 Command Line Tools 提示背后的占位。

## Decision

打包运行（`electronRunAsNode`）每次启动都把指向应用二进制本身的 `node`/`pnpm` 包装对重新生成到 `~/.dsh/desktop-tools`，并把该目录前置到 Host 的 PATH（`apps/desktop/src/pnpm-shims.ts`）；开发运行保留开发者自己的工具链。profile 工作区模板（`packages/boot/app-boot/src/profile.ts`）关闭 `minimumReleaseAge` 与 `confirmModulesPurge`：profile 是用户自己的信任边界，提交安装命令本身就是 `dsh plugin` 声明的信任决定。`dsh plugin`（`apps/cli/src/plugin.ts`）经 GitHub API 把 `github.com` 与 `github:` 规格钉到具体 commit，并改写为带 commit 的 codeload tarball URL，全程不调用 git；精确的 40 位 hex ref 跳过 API 往返，设置了 `GH_TOKEN` 时随请求携带，API 失败则把原规格原样交给 pnpm。`blockedBuildKeys` 同时解析 pnpm 10 的 `onlyBuiltDependencies` 示例列表，一次自动重试即可在两个 pnpm 大版本上收敛，且各自写成打印该格式的版本所能接受的键。

## Verification

CLI 测试通过脚本化的假 pnpm 入口钉住 tarball 改写（API 应答、40 位 hex 跳过、离线原样透传）与两种 allowlist 输出格式。桌面测试钉住 POSIX 与 cmd 包装内容、引号转义、执行位与过期包装替换。profile 测试钉住两个新增工作区设置。

## Alternatives considered

**要求系统安装 Node/pnpm/git 并做强前置检查。** 否决：打包应用的意义就是零配置安装，而失败形态——首次调用 `git` 弹出 Command Line Tools 对话框——对普通用户不可恢复。

**捆绑真实的固定版本 Node 运行时，用其运行 pnpm。** 暂缓：Electron 已自带支持原生 TypeScript 的 Node 24，包装应用二进制只花字节，真实运行时每个平台约 50 MB。当插件需要针对 Electron ABI 缺失的 Node 头文件编译原生模块时再议。

**GUI 只接受 npm registry 规格。** 否决：GitHub 仓库是插件分发的主要渠道；API 钉 commit 既保留该渠道又去掉了 git 依赖。

**把 pnpm 打印的 allowBuilds 键归一化为裸包名。** 否决：pnpm 11 只按它打印的精确 `name@tarball-url` depPath 匹配 git 依赖，pnpm 10 却按裸名匹配，因此每个打印格式都按其原样写回，而不是发明第三种。

## Consequences

- 打包用户安装 GitHub 与 registry 插件只需要系统自带 `/bin/sh`；Node、pnpm、git 均不取自宿主机器。
- GitHub API 钉 commit 为每次安装增加一次网络往返，profile 清单记录的是钉死 commit 的 tarball URL；`dsh plugin update` 走同一条路径重新解析 HEAD。
- 原生依赖缺少 N-API 预编译产物的插件仍需要本地编译器；这是插件生态约束，而非安装链路约束。
- `desktop-tools` 包装每次启动重新生成，应用更新或移动位置后不会留下过期 shim。
