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

手动启动：
```bash
# 后端（在 backend/ 目录下）
uv run uvicorn main:app --host 0.0.0.0 --port 8002 --reload

# 前端（在 frontend/ 目录下）
pnpm dev --port 3004
```

重置所有模拟数据：
```bash
curl -X POST http://localhost:8002/api/reset
```

## 环境变量

将 `.env.example` 复制为 `.env`。LLM 功能只需配置 `MINIMAX_API_KEY`，未配置时 AI 秘书会优雅降级，不影响其他功能。

## 前端验证

每次修改前端代码后，必须在 `frontend/` 目录下运行 `pnpm build` 来捕获 TypeScript 错误。开发服务器不会暴露所有类型错误。

```bash
cd frontend
pnpm build    # TypeScript 全量检查
pnpm lint     # ESLint 检查
```

## 架构说明

### 请求链路

```
前端 (3004)
  → Next.js rewrite：/api/* → http://localhost:8002/api/*
  → FastAPI (8002)
  → SQLite：data/performance.db
  → MiniMax API（仅用于对话和绩效分析）
```

所有前端 API 调用统一通过 `frontend/src/lib/api.ts`，组件不直接调用后端。

### 后端结构（`backend/`）

- `main.py` —— 挂载所有路由到 `/api`，启动时执行 `init_db()` + APScheduler 定时任务
- `routers/` —— 按业务域拆分：`employees`、`decisions`、`agents`、`stream`（SSE）、`reports`、`monthly_meeting`、`chat`、`reset`
- `agents/` —— 4 阶段流水线，由 `/api/agents/*` 路由触发：
  1. `data_collector.py` —— 生成并写入模拟员工数据
  2. `analysis_agent.py` —— 调用 MiniMax 分析绩效
  3. `decision_agent.py` —— 生成晋升/PIP/调薪等决策
  4. `execution_agent.py` —— 执行已审批的决策
- `services/database.py` —— SQLAlchemy async + aiosqlite；4 张表：`employees`、`decisions`、`reports`、`agent_logs`
- `models/employee.py` —— 核心 Pydantic 模型 `EmployeeRecord`

### 前端结构（`frontend/src/`）

- `app/` —— Next.js App Router 页面：`/`（主控台）、`/employees`、`/employees/[id]`、`/decisions`、`/agents`、`/hr-system`、`/monthly-meeting`
- `components/` —— 按业务域组织，与页面结构对应
- `lib/api.ts` —— 所有 API 调用集中在此
- `lib/use-sse.ts` —— SSE Hook，用于实时接收 Agent 状态推送
- `types/index.ts` —— TypeScript 类型定义，与后端 Pydantic 模型对应
- `components/chat/ai-assistant.tsx` —— 悬浮 AI 秘书组件，挂载在所有页面

### 关键约定

**模拟数据固定种子**：`data_collector.py::generate_mock_employees()` 使用 `random.seed(42)`，保证每次重置后全站120名员工数据完全一致。不要删除这行。

**评分权重**：OKR 30% + 360评估 25% + 业务指标 30% + 出勤履职 15% = 综合评分。推荐阈值：≥88 → 晋升，≥80 → 调薪，<45 → PIP，45–55 且下降趋势 → 一对一辅导。

**AI 秘书意图识别**（`routers/chat.py`）：员工查询和晋升意图在到达 MiniMax 之前被本地拦截处理。检测到晋升意图时，将员工真实 DB 数据传给 MiniMax 做诚实分析，**不得基于阈值编造理由**。使用 `</think>` 标签分割（而非正则删除）来提取 MiniMax 思考块之后的正文。

**重名员工**：120人模拟数据集中可能存在同名员工。`_find_employee_in_message` 返回第一个匹配结果。涉及姓名查找的功能，需同时用姓名 + 部门来消歧。

**SSE 实时推送**：`routers/stream.py` 推送 Agent 流水线事件，前端通过 `use-sse.ts` 订阅，`/agents` 页面消费这些事件展示实时状态。

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
