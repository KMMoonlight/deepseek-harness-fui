# 本项目的构建环境。用法: source .scratch/deepseek-fui-desktop/env.sh
#
# 上游 package.json 要求 node ^22.19.0 || >=24.0.0 且 packageManager 为 pnpm@11.7.0。
# 本机默认 node 是 nvm 的 v22.13.0（不满足），但 nvm 里已装有 v22.21.1，直接用它，
# 无需新装任何运行时。pnpm 走 corepack，由 packageManager 字段决定版本。
export PATH="/opt/homebrew/Cellar/nvm/0.39.1_1/versions/node/v22.21.1/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
alias pnpm="corepack pnpm"
