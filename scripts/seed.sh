#!/bin/bash
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR/backend"
uv run python -m agents.data_collector --seed
