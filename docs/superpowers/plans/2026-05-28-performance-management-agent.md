# 绩效管理 Agent Demo — 完整实施计划

**日期：** 2026-05-28
**规格文档：** `docs/superpowers/specs/2026-05-28-performance-management-agent-design.md`
**状态：** 待执行

---

> **Subagent-Driven Development**
> 本计划设计为可由多个 subagent 并行执行。每个 Chunk 独立成块，Chunk 之间通过明确的接口契约衔接。
> 执行时建议：Chunk 1 先行，Chunk 2-3 可并行，Chunk 4-5 串行，Chunk 6-7 可并行。

---

## 技术栈约束

| 层次 | 选型 | 版本 |
|------|------|------|
| 前端框架 | Next.js + React | 15.4 / 19 |
| 样式 | Tailwind CSS | v4 |
| 语言 | TypeScript | 严格模式 |
| 图表 | Recharts | latest |
| 实时通信 | SSE | — |
| 后端 | Python FastAPI | latest |
| AI | MiniMax M2.7 | API |
| 存储 | SQLite | — |
| 定时任务 | APScheduler | latest |
| 包管理 | uv (Python) / pnpm (Node) | — |

---

## 硬性代码规范

- Python 文件 ≤ 300 行
- TypeScript 文件 ≤ 300 行
- 每层文件夹文件数 ≤ 8
- 所有数据结构强类型，禁止 `any`（TS）/ 无类型 `dict`（Python）
- 所有运行操作通过 `scripts/*.sh`
- TDD：先写测试，再写实现

---

## Chunk 1: 项目脚手架与环境配置

**目标：** 搭建前后端项目骨架，配置开发环境，确保 `scripts/start.sh` 一键启动。

### 1.1 后端初始化

- [ ] 创建 `backend/pyproject.toml`
  ```bash
  cd backend && uv init --name performance-agent
  ```
- [ ] 添加依赖
  ```bash
  uv add fastapi uvicorn[standard] pydantic sqlalchemy aiosqlite apscheduler httpx python-dotenv
  uv add --dev pytest pytest-asyncio httpx
  ```
- [ ] 创建目录结构
  ```
  backend/
  ├── agents/          # __init__.py
  ├── models/          # __init__.py
  ├── routers/         # __init__.py
  ├── services/        # __init__.py
  ├── data/            # SQLite 存放
  ├── tests/           # 测试目录
  ├── main.py          # FastAPI 入口（简洁，≤30行）
  └── pyproject.toml
  ```
- [ ] 编写 `backend/main.py`（仅包含 app 创建、CORS、路由挂载、日志配置）
- [ ] 编写 `backend/tests/test_health.py`：测试 `GET /api/health` 返回 200
- [ ] 实现 `backend/routers/health.py`：健康检查端点
- [ ] 验证：`uv run pytest backend/tests/test_health.py` 通过

### 1.2 前端初始化

- [ ] 创建 Next.js 项目
  ```bash
  pnpm create next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --no-import-alias
  ```
- [ ] 确认版本：Next.js 15.4、React 19、Tailwind CSS v4
- [ ] 安装额外依赖
  ```bash
  cd frontend && pnpm add recharts uuid
  pnpm add -D @types/uuid
  ```
- [ ] 配置 `frontend/tsconfig.json`：开启 `strict: true`
- [ ] 创建目录结构
  ```
  frontend/src/
  ├── app/              # App Router
  ├── components/
  │   ├── dashboard/
  │   ├── agents/
  │   └── ui/
  ├── lib/              # API 客户端、工具函数
  └── types/            # 全局类型定义
  ```
- [ ] 编写 `frontend/src/types/index.ts`：定义核心类型（EmployeeRecord、Decision 等）
- [ ] 编写 `frontend/src/lib/api.ts`：API 客户端基础封装（baseURL 从环境变量读取）
- [ ] 验证：`pnpm dev` 启动无报错，访问 localhost:3000 显示默认页面

### 1.3 环境配置

- [ ] 创建项目根目录 `.env.example`
  ```env
  MINIMAX_API_KEY=your_api_key_here
  BACKEND_PORT=8000
  FRONTEND_PORT=3000
  DATABASE_URL=sqlite:///./backend/data/performance.db
  LOG_LEVEL=INFO
  ```
- [ ] 创建 `.env`（gitignore 中排除）
- [ ] 创建 `.gitignore`：排除 `.env`、`logs/`、`__pycache__`、`node_modules/`、`.venv/`、`backend/data/*.db`

### 1.4 日志配置

- [ ] 创建 `logs/` 目录（含 `.gitkeep`）
- [ ] 编写 `backend/services/logger.py`：配置 Python logging，输出到 `logs/backend-{date}.log`
- [ ] 前端日志：开发阶段使用 console，无需文件输出

### 1.5 启停脚本

- [ ] 编写 `scripts/start.sh`
  ```bash
  #!/bin/bash
  # 启动后端
  cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload &
  echo $! > ../logs/backend.pid
  # 启动前端
  cd ../frontend && pnpm dev --port 3000 &
  echo $! > ../logs/frontend.pid
  echo "Services started. Backend: 8000, Frontend: 3000"
  ```
- [ ] 编写 `scripts/stop.sh`
  ```bash
  #!/bin/bash
  kill $(cat logs/backend.pid) 2>/dev/null && rm logs/backend.pid
  kill $(cat logs/frontend.pid) 2>/dev/null && rm logs/frontend.pid
  echo "Services stopped."
  ```
- [ ] 编写 `scripts/seed.sh`
  ```bash
  #!/bin/bash
  cd backend && uv run python -m agents.data_collector --seed
  ```
- [ ] 验证：`bash scripts/start.sh` 启动成功，`bash scripts/stop.sh` 停止成功

### 1.6 Git 初始化

- [ ] `git init && git add . && git commit -m "chore: 项目脚手架初始化"`

**预期产出：**
- 前后端均可独立启动
- 健康检查 API 可访问
- 日志输出到 `logs/` 目录
- 所有操作通过 `scripts/*.sh`

**验收标准：**
- `bash scripts/start.sh` 后，`curl http://localhost:8000/api/health` 返回 `{"status": "ok"}`
- `http://localhost:3000` 显示 Next.js 页面
- `logs/` 目录下有后端日志文件

---

## Chunk 2: Mock 数据层（数据采集 Agent）

**目标：** 实现数据采集 Agent，生成 120 名员工 mock 数据，持久化到 SQLite，暴露 REST API。

### 2.1 Pydantic 数据模型

- [ ] 编写 `backend/models/employee.py`
  ```python
  # 核心字段：
  # id, name, department, level, manager, hire_date
  # okr_score, review_score_360, business_score, attendance_score, composite_score
  # score_history (List[float]), trend (Literal['up','down','stable'])
  # recommendation, recommendation_reason, confidence
  ```
- [ ] 编写 `backend/models/decision.py`
  ```python
  # 核心字段：
  # id, employee_id, employee_name, type, status
  # reason, confidence, created_at, resolved_at, resolved_by, execution_result
  ```
- [ ] 编写 `backend/models/agent_status.py`
  ```python
  # 核心字段：
  # agent_name, status (idle/running/error), last_run_at, next_run_at, run_count
  ```
- [ ] 编写 `backend/models/report.py`
  ```python
  # 核心字段：
  # id, type (daily/weekly/monthly), generated_at, content, summary
  ```
- [ ] 编写 `backend/models/__init__.py`：统一导出

### 2.2 数据库层

- [ ] 编写 `backend/services/database.py`
  - SQLAlchemy async engine 配置
  - 表定义（employees, decisions, reports, agent_logs）
  - `init_db()` 函数：创建表
  - `get_db()` 依赖注入
- [ ] 编写 `backend/tests/test_database.py`：测试表创建和基本 CRUD
- [ ] 验证：测试通过

### 2.3 数据采集 Agent 实现

- [ ] 编写 `backend/tests/test_data_collector.py`
  - 测试生成 120 名员工
  - 测试部门分布正确（研发30/销售25/运营20/财务15/市场18/HR12）
  - 测试建议分布合理（升职~10%/调薪~15%/淘汰~8%/1:1~12%/正常~55%）
  - 测试数据写入 SQLite
- [ ] 编写 `backend/agents/data_collector.py`
  - `generate_mock_employees()` → List[EmployeeRecord]
  - 中文姓名生成（百家姓 + 常用名）
  - 各维度分数按正态分布生成
  - `composite_score` = OKR×0.3 + 360×0.25 + 业务×0.3 + 出勤×0.15
  - 根据综合分自动标注 recommendation
  - `seed_database()` → 写入 SQLite
  - `simulate_fluctuation()` → 模拟数据微小波动（定时任务用）
- [ ] 编写 `backend/agents/__init__.py`
- [ ] 验证：`uv run pytest backend/tests/test_data_collector.py` 全部通过

### 2.4 员工 API 路由

- [ ] 编写 `backend/tests/test_employees_router.py`
  - 测试 GET /api/employees 返回列表（支持分页 ?page=1&size=20）
  - 测试 GET /api/employees?department=研发 筛选
  - 测试 GET /api/employees/{id} 返回详情
  - 测试 GET /api/dashboard/stats 返回统计
- [ ] 编写 `backend/routers/employees.py`
  - `GET /api/employees`：分页 + 部门筛选 + 排序
  - `GET /api/employees/{id}`：单个员工详情
  - `GET /api/dashboard/stats`：统计数据（各类建议人数、部门均分）
- [ ] 验证：所有测试通过

### 2.5 Git Commit

- [ ] `git add . && git commit -m "feat: 数据采集Agent - mock数据生成与员工API"`

**预期产出：**
- 120 名员工数据持久化在 SQLite
- 员工列表/详情/统计 API 可用
- 数据分布符合规格要求

**验收标准：**
- `curl http://localhost:8000/api/employees?page=1&size=10` 返回 10 条记录
- `curl http://localhost:8000/api/dashboard/stats` 返回正确统计
- 数据库文件 `backend/data/performance.db` 存在且包含 120 条记录

---

## Chunk 3: 分析 Agent

**目标：** 实现分析 Agent，调用 MiniMax M2.7 分析员工绩效，含容错降级策略和定时任务。

### 3.1 MiniMax API 客户端

- [ ] 编写 `backend/tests/test_minimax_client.py`
  - 测试正常调用返回结构化结果
  - 测试超时重试（mock httpx）
  - 测试降级到规则引擎
- [ ] 编写 `backend/services/minimax_client.py`
  - `class MiniMaxClient`
  - `async analyze_employee(employee: EmployeeRecord) -> AnalysisResult`
  - 超时 30s，失败重试 2 次
  - 重试失败后降级为规则引擎
  - Prompt 模板：分析员工绩效数据，输出建议标签 + 理由 + 置信度
- [ ] 编写 `backend/services/rule_engine.py`
  - 基于阈值的静态规则（composite_score < 40 → pip，> 85 → promote 等）
  - 作为 AI 降级的 fallback
- [ ] 验证：测试通过

### 3.2 分析 Agent 核心逻辑

- [ ] 编写 `backend/tests/test_analysis_agent.py`
  - 测试批量分析流程
  - 测试分析结果写入数据库
  - 测试降级标记（is_ai_degraded）
  - 测试日报/周报/月报生成
- [ ] 编写 `backend/agents/analysis_agent.py`
  - `class AnalysisAgent`
  - `async run_analysis(scope: str)` → 批量分析员工
  - scope: 'daily'（增量）/ 'weekly'（全量）/ 'monthly'（全量+趋势）
  - 串行调用 MiniMax（避免 rate limit）
  - 分析结果更新 employees 表的 recommendation 字段
  - 生成报告写入 reports 表
- [ ] 验证：测试通过

### 3.3 定时任务配置

- [ ] 编写 `backend/services/scheduler.py`
  - APScheduler 配置
  - 日报触发：每日 08:00（Demo 中可手动触发）
  - 周报触发：每周一 08:00
  - 月报触发：每月 1 日 08:00
  - 数据波动：每小时执行 `simulate_fluctuation()`
- [ ] 在 `backend/main.py` 中注册 scheduler（lifespan event）

### 3.4 Agent 状态与触发路由

- [ ] 编写 `backend/tests/test_agents_router.py`
  - 测试 GET /api/agents/status 返回四个 Agent 状态
  - 测试 POST /api/agents/trigger 手动触发分析
- [ ] 编写 `backend/routers/agents.py`
  - `GET /api/agents/status`：返回四个 Agent 当前状态
  - `POST /api/agents/trigger`：手动触发指定 Agent（body: {agent: "analysis", scope: "daily"}）
- [ ] 验证：所有测试通过

### 3.5 Git Commit

- [ ] `git add . && git commit -m "feat: 分析Agent - MiniMax集成与定时任务"`

**预期产出：**
- MiniMax API 集成完成（含容错）
- 分析 Agent 可手动/定时触发
- 分析结果持久化

**验收标准：**
- `POST /api/agents/trigger {"agent":"analysis","scope":"daily"}` 返回 202
- 分析完成后 employees 表 recommendation 字段已更新
- 无 API Key 时自动降级为规则引擎，结果标记 `is_ai_degraded: true`

---

## Chunk 4: 辅助决策 Agent + SSE 推送

**目标：** 实现决策 Agent，汇总分析结果生成决策建议，通过 SSE 实时推送到前端。

### 4.1 SSE 推送基础设施

- [ ] 编写 `backend/tests/test_sse.py`
  - 测试 SSE 连接建立
  - 测试事件推送格式
  - 测试 client_id 管理
  - 测试断线重连补发（最近 50 条）
- [ ] 编写 `backend/services/sse_manager.py`
  - `class SSEManager`
  - `connect(client_id: str)` → 注册客户端
  - `disconnect(client_id: str)` → 移除客户端
  - `broadcast(event: SSEEvent)` → 广播事件
  - `get_missed_events(client_id: str, last_event_id: str)` → 补发
  - 内存中保留最近 50 条事件
- [ ] 验证：测试通过

### 4.2 决策 Agent 核心逻辑

- [ ] 编写 `backend/tests/test_decision_agent.py`
  - 测试从分析结果生成决策建议
  - 测试决策写入 decisions 表
  - 测试 SSE 推送触发
  - 测试月会议程生成
- [ ] 编写 `backend/agents/decision_agent.py`
  - `class DecisionAgent`
  - `generate_decisions(analysis_results)` → 创建 Decision 记录
  - `push_notification(decision: Decision)` → 通过 SSE 推送
  - `generate_meeting_agenda()` → 汇总所有 pending 决策为月会议程
  - 调用 MiniMax 生成决策摘要文本（含降级）
- [ ] 验证：测试通过

### 4.3 决策审批路由

- [ ] 编写 `backend/tests/test_decisions_router.py`
  - 测试 GET /api/decisions/pending 返回待审批列表
  - 测试 POST /api/decisions/{id}/approve 更新状态
  - 测试 POST /api/decisions/{id}/reject 更新状态
  - 测试审批后触发 SSE 通知
- [ ] 编写 `backend/routers/decisions.py`
  - `GET /api/decisions/pending`：待审批列表（支持分页）
  - `POST /api/decisions/{id}/approve`：确认决策 → 触发执行 Agent
  - `POST /api/decisions/{id}/reject`：驳回决策
  - `POST /api/decisions/{id}/defer`：暂缓决策
- [ ] 验证：所有测试通过

### 4.4 SSE 路由

- [ ] 编写 `backend/routers/stream.py`
  - `GET /api/stream/notifications`：SSE 端点
  - 查询参数：`client_id`、`last_event_id`（用于重连补发）
  - 响应头：`Content-Type: text/event-stream`
- [ ] 验证：使用 curl 测试 SSE 连接
  ```bash
  curl -N http://localhost:8000/api/stream/notifications?client_id=test1
  ```

### 4.5 Git Commit

- [ ] `git add . && git commit -m "feat: 决策Agent - SSE推送与审批流程"`

**预期产出：**
- 决策建议自动生成并推送
- SSE 实时通信可用
- 审批 API 完整

**验收标准：**
- SSE 连接建立后，触发分析 Agent 能收到推送事件
- `GET /api/decisions/pending` 返回待审批列表
- `POST /api/decisions/{id}/approve` 后状态变为 approved

---

## Chunk 5: 执行 Agent + 月会流程

**目标：** 实现执行 Agent，处理已确认的决策，模拟 HR 系统操作，实现月会完整流程。

### 5.1 执行 Agent 核心逻辑

- [ ] 编写 `backend/tests/test_execution_agent.py`
  - 测试执行升职操作（更新 level）
  - 测试执行调薪操作（记录日志）
  - 测试执行 PIP 操作
  - 测试创建 1:1 邀请
  - 测试操作日志写入
  - 测试批量执行
- [ ] 编写 `backend/agents/execution_agent.py`
  - `class ExecutionAgent`
  - `async execute_decision(decision: Decision)` → 根据 type 分发
  - `_execute_promote(decision)` → 更新员工 level
  - `_execute_salary_raise(decision)` → 记录调薪（mock HR系统）
  - `_execute_pip(decision)` → 标记 PIP 状态
  - `_execute_one_on_one(decision)` → 创建日历邀请（mock）
  - `async batch_execute(decisions: List[Decision])` → 批量执行
  - 所有操作写入 agent_logs 表
- [ ] 验证：测试通过

### 5.2 月会流程

- [ ] 编写 `backend/tests/test_monthly_meeting.py`
  - 测试启动月会（汇总 pending 决策）
  - 测试月会议程结构正确
  - 测试月会批量确认
  - 测试月会纪要生成
- [ ] 编写 `backend/services/monthly_meeting.py`
  - `start_meeting()` → 汇总所有 pending 决策，生成议程
  - `confirm_agenda_item(decision_id)` → 逐条确认
  - `finish_meeting()` → 批量执行所有确认项，生成纪要
  - 纪要格式：JSON（含会议日期、参与人、决议列表、执行状态）
- [ ] 验证：测试通过

### 5.3 报告与月会路由

- [ ] 编写 `backend/tests/test_reports_router.py`
  - 测试 GET /api/reports/daily
  - 测试 GET /api/reports/weekly
  - 测试 GET /api/reports/monthly
  - 测试 POST /api/monthly-meeting/start
- [ ] 编写 `backend/routers/reports.py`
  - `GET /api/reports/daily`：最新日报
  - `GET /api/reports/weekly`：最新周报
  - `GET /api/reports/monthly`：最新月报
- [ ] 编写 `backend/routers/monthly_meeting.py`
  - `POST /api/monthly-meeting/start`：启动月会
  - `GET /api/monthly-meeting/agenda`：获取当前议程
  - `POST /api/monthly-meeting/confirm`：批量确认
  - `POST /api/monthly-meeting/finish`：结束月会，生成纪要
- [ ] 验证：所有测试通过

### 5.4 Git Commit

- [ ] `git add . && git commit -m "feat: 执行Agent - HR操作模拟与月会流程"`

**预期产出：**
- 决策执行完整闭环
- 月会流程可一键触发
- 操作日志可追溯

**验收标准：**
- 确认一条升职决策后，员工 level 自动更新
- `POST /api/monthly-meeting/start` 返回结构化议程
- `POST /api/monthly-meeting/finish` 后所有确认项已执行，纪要已生成

---

## Chunk 6: 前端 Dashboard（Nerve Center 主页）

**目标：** 实现总经理主控台，包含 KPI 卡片、图表、Agent 推送列表和实时 SSE 更新。

### 6.1 基础 UI 组件

- [ ] 编写 `frontend/src/components/ui/card.tsx`：通用卡片组件
- [ ] 编写 `frontend/src/components/ui/badge.tsx`：状态标签
- [ ] 编写 `frontend/src/components/ui/button.tsx`：按钮组件
- [ ] 编写 `frontend/src/components/ui/loading.tsx`：加载状态
- [ ] 编写 `frontend/src/components/ui/sidebar.tsx`：侧边导航栏
- [ ] 编写 `frontend/src/app/layout.tsx`：全局布局（含侧边栏导航）

### 6.2 SSE Hook

- [ ] 编写 `frontend/src/lib/use-sse.ts`
  - `useSSE(clientId: string)` 自定义 Hook
  - 自动连接 `/api/stream/notifications`
  - 断线自动重连（携带 last_event_id）
  - 返回 `{ events, isConnected, error }`
- [ ] 编写 `frontend/src/lib/api.ts` 补充：
  - `fetchDashboardStats()`
  - `fetchPendingDecisions()`
  - `approveDecision(id)`
  - `rejectDecision(id)`

### 6.3 Dashboard 组件

- [ ] 编写 `frontend/src/components/dashboard/kpi-cards.tsx`
  - 四张 KPI 卡片：待升职 / 待调薪 / 待淘汰 / 需1:1
  - 数字 + 趋势箭头 + 颜色编码
- [ ] 编写 `frontend/src/components/dashboard/performance-chart.tsx`
  - Recharts 柱状图：本月绩效分布（分数段人数）
- [ ] 编写 `frontend/src/components/dashboard/department-radar.tsx`
  - Recharts 雷达图：部门均分对比
- [ ] 编写 `frontend/src/components/dashboard/notification-list.tsx`
  - Agent 推送列表（实时更新）
  - 每条包含：员工名 | 部门 | 建议理由 | [确认] [驳回] 按钮
  - 确认/驳回后条目状态更新（乐观更新 + 服务端确认）

### 6.4 主页组装

- [ ] 编写 `frontend/src/app/page.tsx`
  - 组合上述组件
  - 使用 SSE Hook 接收实时推送
  - 页面标题："绩效管理中心 · 总经理视角"
  - 右上角显示待审批数量 badge
- [ ] 配置 `frontend/next.config.ts`：API 代理到后端 8000 端口
  ```typescript
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:8000/api/:path*' }]
  }
  ```

### 6.5 验证与 Git Commit

- [ ] 验证：`bash scripts/start.sh` 后访问 `http://localhost:3000`
  - KPI 卡片显示正确数字
  - 图表渲染正常
  - SSE 连接建立（DevTools Network 可见）
  - 点击确认/驳回按钮有响应
- [ ] `git add . && git commit -m "feat: 前端Dashboard - Nerve Center主控台"`

**预期产出：**
- 总经理主控台完整可用
- 实时推送工作正常
- 确认/驳回交互闭环

**验收标准：**
- 页面加载后 KPI 数字与 `/api/dashboard/stats` 一致
- 触发分析 Agent 后，Dashboard 实时收到推送
- 点击确认后，决策状态变为 approved

---

## Chunk 7: 前端其他页面

**目标：** 实现员工绩效、Agent 状态、决策审批、月会管理、HR 系统等完整页面。

### 7.1 员工绩效总览页

- [ ] 编写 `frontend/src/app/employees/page.tsx`
  - 员工列表表格（120人）
  - 筛选：部门下拉、建议类型下拉、搜索框
  - 排序：综合分、OKR、360评估
  - 分页：每页 20 条
  - 每行显示：姓名、部门、职级、综合分、建议标签（颜色编码）
- [ ] 编写 `frontend/src/components/employees/employee-table.tsx`
- [ ] 编写 `frontend/src/components/employees/filter-bar.tsx`

### 7.2 员工详情页

- [ ] 编写 `frontend/src/app/employees/[id]/page.tsx`
  - 员工基础信息卡片
  - 四维度得分雷达图（Recharts）
  - 近 6 个月趋势折线图
  - AI 分析报告（建议 + 理由 + 置信度）
  - 历史决策记录
- [ ] 编写 `frontend/src/components/employees/score-radar.tsx`
- [ ] 编写 `frontend/src/components/employees/trend-chart.tsx`
- [ ] 编写 `frontend/src/components/employees/ai-report.tsx`

### 7.3 Agent 状态页

- [ ] 编写 `frontend/src/app/agents/page.tsx`
  - 四个 Agent 卡片（状态灯：绿/黄/红）
  - 每个 Agent 显示：名称、状态、上次运行、下次运行、运行次数
  - 手动触发按钮（调用 POST /api/agents/trigger）
  - 运行日志时间线
- [ ] 编写 `frontend/src/components/agents/agent-card.tsx`
- [ ] 编写 `frontend/src/components/agents/agent-timeline.tsx`

### 7.4 决策审批页

- [ ] 编写 `frontend/src/app/decisions/page.tsx`
  - 待审批列表（卡片式）
  - 每张卡片：员工信息 + 建议类型 + 理由 + 置信度
  - 操作按钮：确认 / 驳回 / 暂缓
  - 已处理列表（折叠区域）
  - 批量操作：全部确认 / 全部驳回
- [ ] 编写 `frontend/src/components/decisions/decision-card.tsx`
- [ ] 编写 `frontend/src/components/decisions/batch-actions.tsx`

### 7.5 月会管理页

- [ ] 编写 `frontend/src/app/monthly-meeting/page.tsx`
  - "启动月会" 按钮
  - 月会议程列表（启动后显示）
  - 逐条确认/驳回
  - "结束月会" 按钮 → 生成纪要
  - 月会纪要展示（可打印 HTML 格式）
- [ ] 编写 `frontend/src/components/meeting/agenda-list.tsx`
- [ ] 编写 `frontend/src/components/meeting/meeting-minutes.tsx`

### 7.6 HR 系统确认页

- [ ] 编写 `frontend/src/app/hr-system/page.tsx`
  - 已执行操作列表
  - 操作类型标签（升职/调薪/PIP/1:1）
  - 执行时间、执行结果
  - 模拟 HR 系统确认界面（展示变更前后对比）
- [ ] 编写 `frontend/src/components/hr/operation-log.tsx`
- [ ] 编写 `frontend/src/components/hr/change-diff.tsx`

### 7.7 导航与路由整合

- [ ] 更新 `frontend/src/components/ui/sidebar.tsx`
  - 导航项：主控台 / 员工绩效 / Agent状态 / 决策审批 / 月会管理 / HR系统
  - 当前路由高亮
  - 待审批数量 badge
- [ ] 确保所有页面响应式布局（移动端适配）

### 7.8 验证与 Git Commit

- [ ] 验证：逐页访问，确认数据加载和交互正常
  - `/employees`：列表渲染、筛选工作
  - `/employees/[id]`：详情页图表正常
  - `/agents`：状态显示、手动触发可用
  - `/decisions`：审批流程完整
  - `/monthly-meeting`：月会流程可走通
  - `/hr-system`：操作日志展示
- [ ] `git add . && git commit -m "feat: 前端完整页面 - 员工/Agent/决策/月会/HR"`

**预期产出：**
- 7 个页面全部可用
- 所有交互闭环
- 响应式布局

**验收标准：**
- 所有页面无 TypeScript 编译错误
- 所有页面数据从后端 API 加载（非硬编码）
- 员工详情页图表正确渲染
- 月会流程可从启动到生成纪要完整走通

---

## 执行顺序与依赖关系

```
Chunk 1 (脚手架)
    │
    ├──→ Chunk 2 (数据层)  ──→ Chunk 3 (分析Agent)
    │                              │
    │                              ▼
    │                        Chunk 4 (决策Agent+SSE) ──→ Chunk 5 (执行Agent+月会)
    │
    └──→ Chunk 6 (Dashboard)  ──→ Chunk 7 (其他页面)
```

**并行策略：**
- Chunk 2 + Chunk 6 可并行（后端数据层 + 前端 UI 骨架）
- Chunk 3 依赖 Chunk 2
- Chunk 4 依赖 Chunk 3
- Chunk 5 依赖 Chunk 4
- Chunk 7 依赖 Chunk 5 + Chunk 6

**估算工时：**
- Chunk 1: ~1h
- Chunk 2: ~2h
- Chunk 3: ~3h（含 MiniMax 集成调试）
- Chunk 4: ~2h
- Chunk 5: ~2h
- Chunk 6: ~3h
- Chunk 7: ~4h
- **总计：~17h**

---

## 文件清单（完整）

### 后端文件

```
backend/
├── main.py                          # FastAPI 入口
├── pyproject.toml                   # uv 项目配置
├── agents/
│   ├── __init__.py
│   ├── data_collector.py            # 数据采集 Agent
│   ├── analysis_agent.py           # 分析 Agent
│   ├── decision_agent.py           # 辅助决策 Agent
│   └── execution_agent.py          # 执行 Agent
├── models/
│   ├── __init__.py
│   ├── employee.py                  # EmployeeRecord 模型
│   ├── decision.py                  # Decision 模型
│   ├── agent_status.py             # AgentStatus 模型
│   └── report.py                    # Report 模型
├── routers/
│   ├── __init__.py
│   ├── health.py                    # 健康检查
│   ├── employees.py                 # 员工 API
│   ├── agents.py                    # Agent 管理 API
│   ├── decisions.py                 # 决策审批 API
│   ├── reports.py                   # 报告 API
│   ├── monthly_meeting.py          # 月会 API
│   └── stream.py                    # SSE 推送
├── services/
│   ├── __init__.py
│   ├── database.py                  # SQLAlchemy 配置
│   ├── logger.py                    # 日志配置
│   ├── minimax_client.py           # MiniMax API 客户端
│   ├── rule_engine.py              # 规则引擎（降级）
│   ├── scheduler.py                # APScheduler 配置
│   ├── sse_manager.py              # SSE 连接管理
│   └── monthly_meeting.py          # 月会业务逻辑
├── data/
│   └── .gitkeep
└── tests/
    ├── __init__.py
    ├── conftest.py                  # pytest fixtures
    ├── test_health.py
    ├── test_database.py
    ├── test_data_collector.py
    ├── test_minimax_client.py
    ├── test_analysis_agent.py
    ├── test_decision_agent.py
    ├── test_execution_agent.py
    ├── test_monthly_meeting.py
    ├── test_sse.py
    ├── test_employees_router.py
    ├── test_agents_router.py
    ├── test_decisions_router.py
    └── test_reports_router.py
```

### 前端文件

```
frontend/src/
├── app/
│   ├── layout.tsx                   # 全局布局
│   ├── page.tsx                     # Nerve Center 主页
│   ├── employees/
│   │   ├── page.tsx                 # 员工列表
│   │   └── [id]/
│   │       └── page.tsx             # 员工详情
│   ├── agents/
│   │   └── page.tsx                 # Agent 状态
│   ├── decisions/
│   │   └── page.tsx                 # 决策审批
│   ├── monthly-meeting/
│   │   └── page.tsx                 # 月会管理
│   └── hr-system/
│       └── page.tsx                 # HR 系统
├── components/
│   ├── dashboard/
│   │   ├── kpi-cards.tsx
│   │   ├── performance-chart.tsx
│   │   ├── department-radar.tsx
│   │   └── notification-list.tsx
│   ├── employees/
│   │   ├── employee-table.tsx
│   │   ├── filter-bar.tsx
│   │   ├── score-radar.tsx
│   │   ├── trend-chart.tsx
│   │   └── ai-report.tsx
│   ├── agents/
│   │   ├── agent-card.tsx
│   │   └── agent-timeline.tsx
│   ├── decisions/
│   │   ├── decision-card.tsx
│   │   └── batch-actions.tsx
│   ├── meeting/
│   │   ├── agenda-list.tsx
│   │   └── meeting-minutes.tsx
│   ├── hr/
│   │   ├── operation-log.tsx
│   │   └── change-diff.tsx
│   └── ui/
│       ├── card.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── loading.tsx
│       └── sidebar.tsx
├── lib/
│   ├── api.ts                       # API 客户端
│   └── use-sse.ts                   # SSE Hook
└── types/
    └── index.ts                     # 全局类型定义
```

### 项目根目录文件

```
绩效管理agent/
├── .env.example
├── .env                             # (gitignore)
├── .gitignore
├── scripts/
│   ├── start.sh
│   ├── stop.sh
│   └── seed.sh
├── logs/
│   └── .gitkeep
└── docs/
    └── ...
```

---

## 最终验收清单

- [ ] `bash scripts/start.sh` 一键启动前后端
- [ ] `bash scripts/seed.sh` 生成 120 名员工 mock 数据
- [ ] Dashboard 显示正确 KPI 数字和图表
- [ ] SSE 实时推送工作正常
- [ ] 手动触发分析 Agent，Dashboard 收到推送
- [ ] 确认/驳回决策后，状态正确更新
- [ ] 月会流程完整走通（启动 → 逐条确认 → 结束 → 纪要）
- [ ] 所有页面无 TypeScript 编译错误
- [ ] `uv run pytest` 后端测试全部通过
- [ ] 日志正确输出到 `logs/` 目录
- [ ] 无 MiniMax API Key 时系统正常降级运行
- [ ] `bash scripts/stop.sh` 正确停止所有服务
