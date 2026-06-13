#!/bin/bash
# 启动生产服务（后端用 pm2 守护）
set -e

ROOT_DIR="/home/ubuntu/performance-agent"
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

mkdir -p "$ROOT_DIR/logs"

echo "=== 停止旧进程 ==="
pm2 delete performance-backend 2>/dev/null || true
pm2 delete performance-frontend 2>/dev/null || true

echo "=== 启动后端 ==="
cd "$ROOT_DIR/backend"
pm2 start ~/.local/bin/uv \
  --name performance-backend \
  --interpreter none \
  -- run uvicorn main:app --host 127.0.0.1 --port 8002
pm2 save

echo "=== 启动前端 (Next.js standalone) ==="
cd "$ROOT_DIR/frontend"
PORT=3004 pm2 start node \
  --name performance-frontend \
  -- .next/standalone/server.js
pm2 save

echo "=== 确保 nginx 运行 ==="
sudo systemctl restart nginx

echo ""
pm2 list
echo ""
echo "✅ 服务已启动，访问 http://119.28.118.104"
