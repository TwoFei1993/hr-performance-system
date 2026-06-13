# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

通威集团绩效管理 Agent 系统 —— 基于 AI 的 HR 绩效管理平台。后端：FastAPI + SQLite；前端：Next.js 15 App Router；大模型：MiniMax M2.7（REST API）。

## 启动项目

```bash
bash scripts/start.sh
# 后端：http://localhost:8002  （日志：logs/backend.log）
# 前端：http://localhost:3004  （日志：logs/frontend.log）
```

`start.sh` 会自动清理 `.next` 缓存再启动。**不要直接用 `pnpm dev`**，必须通过脚本，否则 `pnpm build` 后开发服务器会崩溃。

手动启动：
```bash
# 后端
cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# 前端
cd frontend && rm -rf .next && pnpm dev --port 3004
```

重置所有模拟数据：
```bash
curl -X POST http://localhost:8002/api/reset
```

## 环境变量

将 `.env.example` 复制为 `.env`。LLM 功能只需配置 `MINIMAX_API_KEY`，未配置时 AI 秘书优雅降级。

## 前端验证

```bash
cd frontend
pnpm build    # TypeScript 全量检查（会覆盖 .next，之后需重启开发服务器）
pnpm lint
```

`pnpm build` 后必须重新运行 `bash scripts/start.sh` 才能恢复开发服务器。

## 部署

### 腾讯轻量云（生产，推荐演示用）

```
服务器：119.28.118.104
前端：http://119.28.118.104:8080
后端 API：http://119.28.118.104:8002
```

```bash
# 首次安装
bash ~/performance-agent/scripts/setup-server.sh

# 启动/重启服务（pm2 守护）
bash ~/performance-agent/scripts/start-prod.sh
```

服务器构建前端需加环境变量：`STANDALONE=1 pnpm build`。构建完成后需复制静态文件：
```bash
cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public
```

### Cloudflare Pages（可选）

- 构建命令：`cd frontend && npm install -g pnpm && pnpm install && npx @cloudflare/next-on-pages`
- 输出目录：`frontend/.vercel/output/static`
- 环境变量：`NEXT_PUBLIC_API_URL=https://perf-backend.shaoyife.workers.dev`
- Compatibility flags（Production + Preview）：`nodejs_compat`
- 动态路由页面需要 `export const runtime = 'edge'`（已在 `/agents/[name]` 和 `/employees/[id]` 添加）
- Cloudflare Worker（`cloudflare-worker/worker.js`）代理后端请求，Worker 不能请求裸 IP，需通过域名

## 架构说明

### 请求链路

```
本地开发：
  前端 (3004) → Next.js rewrite /api/* → FastAPI (8002) → SQLite

Cloudflare Pages 生产：
  浏览器 → Cloudflare Pages → Worker proxy → FastAPI (8002)
```

`api.ts` 的 `BASE_URL = (NEXT_PUBLIC_API_URL ?? '') + '/api'`，本地为空走相对路径，生产指向 Worker 地址。SSE URL（`use-sse.ts`）同样读取此变量。

### 后端结构（`backend/`）

- `main.py` —— 路由挂载、CORS（`allow_origins=["*"]`）、APScheduler 定时任务
- `routers/` —— 业务域：`employees`、`decisions`、`agents`、`stream`（SSE）、`reports`、`monthly_meeting`、`chat`、`reset`
- `agents/` —— 4 阶段流水线：`data_collector` → `analysis_agent` → `decision_agent` → `execution_agent`
- `services/database.py` —— SQLAlchemy async + aiosqlite，4 张表：`employees`、`decisions`、`reports`、`agent_logs`

### 前端结构（`frontend/src/`）

- `lib/api.ts` —— 所有 API 调用集中在此
- `lib/use-sse.ts` —— SSE Hook，实时接收 Agent 状态推送
- `components/chat/ai-assistant.tsx` —— 悬浮 AI 秘书，挂载在所有页面
- `components/agents/agent-network-diagram.tsx` —— 多智能体协作 SVG 图，GSAP Timeline 驱动动画

### 关键约定

**模拟数据固定种子**：`data_collector.py::generate_mock_employees()` 使用 `random.seed(42)`，保证重置后120名员工数据完全一致。不要删除这行。

**评分权重**：OKR 30% + 360评估 25% + 业务指标 30% + 出勤履职 15%。推荐阈值：≥88 晋升，≥80 调薪，<45 PIP，45–55 且下降趋势 → 一对一辅导。

**AI 秘书意图识别**（`routers/chat.py`）：员工查询和晋升意图在到达 MiniMax 前被本地拦截。晋升意图检测后将员工真实 DB 数据传给 MiniMax，**不得基于阈值编造理由**。用 `</think>` 标签分割提取正文。

**SSE**：`routers/stream.py` 推送 Agent 事件，`/agents` 页面消费展示实时状态。

## 数据库调试

```bash
cd backend
uv run python -c "
import asyncio
from services.database import AsyncSessionLocal, EmployeeORM
from sqlalchemy import select

async def q():
    async with AsyncSessionLocal() as db:
        r = await db.execute(select(EmployeeORM).limit(5))
        for e in r.scalars():
            print(e.name, e.recommendation, e.composite_score)

asyncio.run(q())
"
```

## Git

推送时如遇代理错误（`via 127.0.0.1:7890`）：
```bash
git -c http.proxy="" -c https.proxy="" push
```

版本标签 `v1.0-demo`：2026-06-13 功能完整的演示版本。
