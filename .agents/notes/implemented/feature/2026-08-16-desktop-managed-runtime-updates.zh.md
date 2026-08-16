# Agent Note: 桌面端通过经过校验的受管运行时完成更新

Status: implemented

[English](2026-08-16-desktop-managed-runtime-updates.md) | 中文

## 问题

打包桌面应用携带一套完整的 Harness 运行时，但只有已发布 Harness 包发生变化时，替换整个应用代价过高。不能更新应用资源内部的 `node_modules`：这些文件属于不可变且经过签名的应用；局部更新还可能把不同版本的 CLI、FUI bundle、Web 前端与 Host plugin 混在一起。把包管理器 bridge 暴露给 renderer，也会赋予它超出单一固定产品更新所需的本机权限。

npm 包标识本身不能证明 FUI 兼容性。某个已发布的 `@deepseek-ai/dsh` 版本可能不包含本产品的 `@deepseek-ai/dsh-fui-app` 依赖。选择这样的版本会让持久化的 `fui` profile 缺少内置 bundle，导致下次启动失败。

## 决策

FUI 层挂载一项仅限桌面端的能力，其中包括 Host provider 和 Client 设置 consumer。`dsh-host-runtime-updater` 负责 registry 访问、兼容性检查、包管理器执行、安装校验和活动版本指针。`dsh-client-ui-settings-runtime-updater` 在「通用设置」中贡献一行。renderer 只能请求 `describe` 或一次完整的 `update`；包标识、registry、dist-tag、文件系统目标、进程策略和命令参数都留在 Host 配置中。

用户点击一次后，Host 会读取配置的 npm dist-tag。只有同时满足以下条件的版本才符合资格：版本是有效 semver、高于当前运行版本，并且 registry manifest 声明了 `@deepseek-ai/dsh-fui-app`。Host 使用受管 subprocess 服务运行应用内置的 pnpm 入口，把准确版本的 `@deepseek-ai/dsh` 安装到 `$DSH_HOME/desktop-runtime` 下的私有临时项目。安装过程使用清除凭据后的父进程环境，限制输出，设置截止时间，并接受请求取消与 plugin 卸载取消。

provider 会把已有但无效的版本移入可恢复的隔离目录。新依赖树必须包含版本准确的 CLI 包、FUI bundle 与 Web 前端，且 `dsh --version` 必须报告请求的版本。只有这些检查全部成功，provider 才会原子写入 `current.json`。应用资源保持不变，并继续提供 pnpm 与回退运行时。

Electron 在启动 Host 前校验 `current.json` 及其引用的依赖树，并优先尝试受管运行时。无效指针数据或缺失入口会移出活动指针位置并得到保留；若受管 Host 在就绪前失败，也采用相同处理；随后 Electron 启动应用内置运行时。指针只影响下一次应用启动，因此运行中的 Cordis plugin 图不会围绕活动 Session 或 profile 变更被替换。

[桌面运行时打包决策](../architecture/2026-08-15-electron-fui-desktop-runtime.md)继续负责 Electron 进程与不可变基线。[桌面插件安装决策](2026-08-15-desktop-plugin-installation.md)保持独立：插件安装修改可写的 `fui` profile，运行时安装则选择解析该 profile 的内置包闭包。

## 验证

Host 测试覆盖 registry 响应校验、准确版本比较、强制 FUI 依赖、串行更新、包管理器 argv 与环境、有界诊断、超时、取消、结构校验、CLI 版本校验、指针提交、隔离和卸载。Electron 测试覆盖指针解析、受管版本优先选择、无效指针回退与受管运行时就绪失败回退。Client 测试覆盖初始说明、禁用和忙碌状态、单击调用、取消、本地化成功、不兼容和稳定失败。装配后的桌面 FUI 验收通过真实 Host、Remote、Client plugin 与 slot 图记录「通用设置」行，且不会发起 registry 请求。

## 考虑过的替代方案

- **原地修改应用资源**：否决，因为经过签名的应用文件属于不可变分发状态；中断或局部安装会破坏唯一可启动的运行时。
- **安装任意更高版本的 `@deepseek-ai/dsh`**：否决，因为根包可能不包含 FUI bundle；包标识与成功的 CLI 冒烟测试不能证明 FUI profile 可以完成组合。
- **在 renderer 中运行 npm 或 pnpm**：否决，因为 renderer 只需要一项固定更新操作，不需要通用文件系统、registry 或进程权限。
- **使用全局 npm 安装**：否决，因为图标启动必须保持自包含；全局包的所有权不属于应用，全局更新也不能提供原子回退。
- **每次 Harness 变化都要求完整桌面版本**：Electron 壳与签名变化仍采用这种方式；但它不作为唯一运行时路径，因为经过校验的用户自有运行时可以在不修改应用的情况下更新 plugin 闭包。

## 后果

- 用户必须明确点击**检查并更新**；不会静默后台安装。
- 兼容的 npm 版本无需终端即可安装，但只有完全重启应用后才会激活。
- 缺少 FUI bundle 的版本会报告不兼容，无法替换正常工作的运行时。
- 更新后，应用可能同时保留两份运行时：不可变回退基线与选中的受管依赖树。隔离的失败版本会额外占用用户存储，直到操作人员删除。
- profile 数据与第三方 plugin 仍位于 `$DSH_HOME/profiles/fui`，运行时更新和应用更新都不会清除它们；但第三方 plugin 自身仍可能需要兼容性更新。
- 更新器不会增加模型可见输入或 Session 事件。
