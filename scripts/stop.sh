#!/bin/bash
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$ROOT_DIR/logs/backend.pid" ]; then
  kill $(cat "$ROOT_DIR/logs/backend.pid") 2>/dev/null && echo "Backend stopped"
  rm "$ROOT_DIR/logs/backend.pid"
fi
if [ -f "$ROOT_DIR/logs/frontend.pid" ]; then
  kill $(cat "$ROOT_DIR/logs/frontend.pid") 2>/dev/null && echo "Frontend stopped"
  rm "$ROOT_DIR/logs/frontend.pid"
fi
