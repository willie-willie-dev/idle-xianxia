#!/bin/bash
# 登仙统一服务：默认先构建游戏前端，再启动单端口进程。
set -euo pipefail

ADMIN_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$ADMIN_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
用法: admin/run.sh [--no-build]

默认先在 mvp/ 执行 npm run build，再 exec node admin/server.ts。
  --no-build  跳过构建，直接启动（systemd 使用）
  --help      显示本说明
EOF
}

skip_build=0
if [[ $# -gt 1 ]]; then
  echo "参数过多" >&2
  usage >&2
  exit 2
fi
case "${1:-}" in
  '') ;;
  --no-build) skip_build=1 ;;
  --help|-h) usage; exit 0 ;;
  *) echo "未知参数: $1" >&2; usage >&2; exit 2 ;;
esac

cd "$ROOT"
if [[ "$skip_build" -eq 0 ]]; then
  ( cd "$ROOT/mvp" && npm run build )
fi
exec node admin/server.ts
