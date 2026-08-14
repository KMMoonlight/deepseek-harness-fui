# 10 — 三平台打包分发

**What to build:** 产出三平台可安装包，目标机器无需预装任何东西。

这一票的重量集中在原生依赖上：Node 运行时和整个 dsh runtime 要随包分发；Windows 的目录选择器依赖一个 FFI 模块；Linux 的沙箱依赖一个原生可执行文件，还涉及权限。Tauri 不带浏览器内核省下的体积，很大一部分要还回给这些。

如果实施时发现单票过重，按平台拆成三张子票是合理的。

**Blocked by:** 08

**Status:** 部分完成 —— sidecar 未实现，三平台验证未做；这两项超出本次可达范围

- [ ] **Node 运行时与 dsh runtime 随包分发** —— 未实现，见下方尺寸测算
- [ ] Windows 目录选择器原生模块 —— 依赖 sidecar，未开始
- [ ] Linux 沙箱原生可执行文件 —— 依赖 sidecar，未开始
- [~] **macOS 产出了 `.app`（4.0 MB）**；Windows / Linux 的 CI 配置已写好但**未在实机验证**
- [ ] macOS 签名与公证 —— 需要开发者证书与 Apple ID 凭据，本次不具备
- [x] **体积已测量**，见下

## 已交付

- `.github/workflows/desktop-release.yml` —— 四目标矩阵（macOS arm64/x64、Linux x64、Windows x64），
  含 Linux 的 WebKitGTK / AppIndicator 系统依赖、corepack、慢链路的 fetch 超时放宽
- macOS `.app` 实际产出并验证可构建
- 顺带清零了 Rust 编译警告（signal handler 的函数指针转换要经 `as *const ()`，直接转是不对的）

## 尺寸测算：打包的真实问题在 sidecar

| 组成 | 体积 |
|---|---|
| Tauri 壳（.app） | **4.0 MB** |
| Node 运行时 | 189 MB |
| harness 构建产物（各包 lib） | 59 MB |
| 前端 dist | 12 MB |
| node_modules（整仓，未裁剪） | 1.4 GB |

结论很清楚：**壳只占 4 MB，打包工作 100% 是 sidecar 的事**。
而且这印证了之前的判断 —— Tauri 不带 Chromium 省下的体积，会被随包的 Node 运行时吃掉大半。

要让 `.app` 真正可独立运行，还需要：裁剪出运行时真正需要的 node_modules 闭包（1.4 GB 显然不能整包带）、
把 Node 与裁剪后的 harness 作为 Tauri resource 打进去、把 `main.rs` 里 spawn `pnpm` 改成 spawn 打包内的 node，
以及处理 koffi（Windows 目录选择器）和 landlock-run（Linux 沙箱）这两个原生依赖的平台产物与权限。

## 为什么没做完

这两项不是时间问题，是资源问题：三平台验证需要对应机器或 CI 实跑，签名公证需要用户的开发者凭据。
sidecar 本身工作量接近一张独立工单，把它塞进这张票只会得到一个半成品。
建议按平台拆成三张子票，并把 sidecar 单独立一票排在它们前面。
