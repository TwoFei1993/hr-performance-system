#!/bin/bash
# 在服务器上运行一次，安装所有依赖
set -e

APP_DIR="/home/ubuntu/performance-agent"

echo "=== 安装系统依赖 ==="
sudo apt-get update -qq
sudo apt-get install -y nginx curl unzip

echo "=== 安装 Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm pm2

echo "=== 安装 uv (Python 包管理) ==="
curl -LsSf https://astral.sh/uv/install.sh | sh
export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

echo "=== 安装 Python 后端依赖 ==="
cd "$APP_DIR/backend"
~/.local/bin/uv sync

echo "=== 安装前端依赖并构建 ==="
cd "$APP_DIR/frontend"
pnpm install --frozen-lockfile
STANDALONE=1 pnpm build

echo "=== 配置 nginx ==="
sudo cp "$APP_DIR/scripts/nginx.conf" /etc/nginx/sites-available/performance-agent
sudo ln -sf /etc/nginx/sites-available/performance-agent /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

echo ""
echo "✅ 安装完成！运行 bash ~/performance-agent/scripts/start-prod.sh 启动服务"
