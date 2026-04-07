#!/usr/bin/env bash
# 本机一键：同步代码到服务器并 docker compose up -d --build
# 用法（在仓库根 music/）：
#   cp configurable/deploy/.env.deploy.example configurable/deploy/.env.deploy
#   # 编辑 .env.deploy
#   bash configurable/deploy/push-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

ENV_FILE="$(dirname "$0")/.env.deploy"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
DEPLOY_PATH="${DEPLOY_PATH:-/home/ubuntu/music}"

if [[ -z "${DEPLOY_HOST:-}" ]]; then
  echo "错误: 请设置 DEPLOY_HOST（在 configurable/deploy/.env.deploy 或环境变量）" >&2
  echo "示例: cp configurable/deploy/.env.deploy.example configurable/deploy/.env.deploy" >&2
  exit 1
fi

REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
RSYNC_DELETE=()
if [[ "${DEPLOY_RSYNC_DELETE:-0}" == "1" ]]; then
  RSYNC_DELETE=(--delete)
  echo "注意: 已启用 rsync --delete（会按本地目录裁剪远端同名目录内多余文件）"
fi

RSYNC_EXCLUDES=(
  "${RSYNC_DELETE[@]}"
  --exclude=.git
  --exclude=node_modules
  --exclude=dist
  --exclude=release
  --exclude=electron
  --exclude=coverage
  --exclude=configurable/web/.vite
  --exclude=configurable/server/data
  --exclude=.env.deploy
  --exclude=.env
)

echo "==> rsync 到 ${REMOTE}:${DEPLOY_PATH}/"
rsync -avz "${RSYNC_EXCLUDES[@]}" ./ "${REMOTE}:${DEPLOY_PATH}/"

echo "==> 远端构建并启动容器"
ssh "${REMOTE}" "cd $(printf %q "${DEPLOY_PATH}") && bash configurable/deploy/deploy.sh up -d --build"

echo "==> 完成。浏览器访问 http://${DEPLOY_HOST}/ （若端口非 80 请自行调整）"
