#!/bin/bash
set -e
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT_DIR/logs"

echo "Starting backend..."
cd "$ROOT_DIR/backend"
uv run uvicorn main:app --host 0.0.0.0 --port 8002 --reload > "$ROOT_DIR/logs/backend.log" 2>&1 &
echo $! > "$ROOT_DIR/logs/backend.pid"

echo "Starting frontend..."
cd "$ROOT_DIR/frontend"
rm -rf .next
pnpm dev --port 3004 > "$ROOT_DIR/logs/frontend.log" 2>&1 &
echo $! > "$ROOT_DIR/logs/frontend.pid"

echo "Services started. Backend: http://localhost:8002, Frontend: http://localhost:3004"
