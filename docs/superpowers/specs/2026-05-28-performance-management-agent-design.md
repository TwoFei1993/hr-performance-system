# 绩效管理 Agent 系统 — 设计规格文档

**日期：** 2026-05-28  
**版本：** v1.0  
**状态：** 待审批

---

## 1. 项目概述

为通威集团构建一套基于 AI 多 Agent 架构的绩效管理 Demo 系统。系统模拟真实企业绩效管理流程，通过四层 Agent 协作，实现从数据采集、智能分析、辅助决策到自动执行的完整闭环。

**核心目标：**
- 展示 AI Agent 在 HR 绩效管理场景中的落地价值
- 为总经理提供智能化决策支持，减少人工分析工作量
- 演示 Agent 自动推送日/周/月报告并支持一键执行的完整流程

---

## 2. 技术栈

| 层次 | 技术选型 |
|------|---------|
| 前端框架 | Next.js 15.4 + React 19 |
| 前端样式 | Tailwind CSS v4 |
| 前端语言 | TypeScript（严格模式） |
| 图表库 | Recharts |
| 实时通信 | Server-Sent Events (SSE) |
| 后端框架 | Python FastAPI |
| AI 模型 | MiniMax M2.7（通过 API 调用） |
| 数据存储 | SQLite（mock 数据持久化） |
| 定时任务 | APScheduler |
| 包管理 | uv（Python）/ pnpm（Node） |

---

## 3. 系统架构

### 3.1 整体分层

```
┌─────────────────────────────────────────────────────┐
│                   前端 Dashboard                      │
│  Nerve Center | 员工绩效 | Agent状态 | 决策审批 | 月会  │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP / SSE
┌──────────────────────▼──────────────────────────────┐
│                  FastAPI 后端                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │数据采集   │→│ 分析Agent │→│辅助决策   │            │
│  │  Agent   │  │          │  │  Agent   │            │
│  └──────────┘  └──────────┘  └────┬─────┘           │
│                                   │ 总经理确认         │
│                              ┌────▼─────┐            │
│                              │ 执行Agent │            │
│                              └──────────┘            │
└─────────────────────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────┐
│              MiniMax M2.7 API                        │
│         （分析层 + 决策层调用）                        │
└─────────────────────────────────────────────────────┘
```

### 3.2 四层 Agent 职责

**① 数据采集 Agent（`data_collector`）**
- 启动时生成 120 名员工的 mock 数据，涵盖 6 个部门
- 数据维度：基础信息、OKR 完成率、360 评估分、业务指标、出勤记录
- 定时任务：每小时模拟数据微小波动，保持数据"活跃感"
- 输出：结构化 `EmployeeRecord` 对象列表，存入 SQLite

**② 分析 Agent（`analysis_agent`）**
- 读取员工数据，调用 MiniMax M2.7 进行深度分析
- 分析维度：综合绩效得分、履职评估、趋势判断
- 输出四类建议标签：`升职` / `调薪` / `淘汰` / `需1:1`
- 每次分析结果附带置信度和关键依据
- 定时触发：日报（每日 8:00）、周报（每周一）、月报（每月 1 日）

**③ 辅助决策 Agent — Nerve Center（`decision_agent`）**
- 汇总分析结果，生成结构化决策建议报告
- 推送机制：通过 SSE 实时推送到前端 Dashboard
- 支持总经理对每条建议执行：确认 / 驳回 / 暂缓
- 月会模式：一键生成月会议程，包含所有待决策事项

**④ 执行 Agent（`execution_agent`）**
- 接收总经理确认的决议，执行对应操作
- 操作类型：更新职级、触发调薪流程、创建 1:1 日历邀请、记录月会决议
- 所有执行操作写入操作日志，支持回溯
- 模拟 HR 系统 API 调用（mock 实现）

---

## 4. Mock 数据规格

### 4.1 员工数据结构

```typescript
interface EmployeeRecord {
  id: string
  name: string
  department: string        // 6个部门：研发/销售/运营/财务/市场/HR
  level: string             // P4-P9 职级体系
  manager: string
  hireDate: string
  
  // 绩效数据
  okrScore: number          // 0-100，OKR完成率
  reviewScore360: number    // 0-100，360评估
  businessScore: number     // 0-100，业务指标
  attendanceScore: number   // 0-100，出勤履职
  compositeScore: number    // 加权综合分
  
  // 趋势
  scoreHistory: number[]    // 近6个月得分
  trend: 'up' | 'down' | 'stable'
  
  // Agent 建议
  recommendation: 'promote' | 'salary_raise' | 'pip' | 'one_on_one' | 'normal'
  recommendationReason: string
  confidence: number        // 0-1
}
```

### 4.2 数据分布（120人）

| 部门 | 人数 | 说明 |
|------|------|------|
| 研发 | 30 | P4-P8，技术岗 |
| 销售 | 25 | P4-P7，业绩导向 |
| 运营 | 20 | P4-P7 |
| 财务 | 15 | P5-P8 |
| 市场 | 18 | P4-P7 |
| HR | 12 | P4-P7 |

**建议分布（模拟真实比例）：**
- 升职建议：~10%（12人）
- 调薪建议：~15%（18人）
- 淘汰/PIP：~8%（10人）
- 需1:1：~12%（14人）
- 正常：~55%（66人）

---

## 5. 前端页面设计

### 5.1 页面列表

| 路由 | 页面名称 | 核心功能 |
|------|---------|---------|
| `/` | Nerve Center | 总经理主控台，KPI 概览 + Agent 推送 |
| `/employees` | 员工绩效总览 | 120人列表，筛选/排序/搜索 |
| `/employees/[id]` | 员工详情 | 个人绩效详情 + AI 分析报告 |
| `/agents` | Agent 状态 | 四个 Agent 实时执行状态可视化 |
| `/decisions` | 决策审批 | 待确认事项列表，支持批量操作 |
| `/monthly-meeting` | 月会管理 | 月会议程生成 + 执行确认 |
| `/hr-system` | HR 系统 | 调薪/职级变更确认界面 |

### 5.2 Nerve Center 布局（主页）

```
┌─────────────────────────────────────────────────────┐
│  绩效管理中心  [总经理视角]          ● 3项待审批  [月会] │
├──────────┬──────────┬──────────┬────────────────────┤
│  待升职   │  待调薪  │  待淘汰  │    需1:1           │
│   12人   │   18人   │   10人   │    14人            │
├──────────┴──────────┴──────────┴────────────────────┤
│  本月绩效分布（柱状图）  │  部门均分对比（雷达图）      │
├─────────────────────────────────────────────────────┤
│  🤖 Agent 推送 · 今日                                │
│  ┌─────────────────────────────────────────────┐   │
│  │ 张三 | 研发部 | Q3绩效连续下滑 → 建议1:1    [确认]│  │
│  │ 李四 | 销售部 | 超额完成OKR 120% → 建议升职  [确认]│  │
│  │ 王五 | 运营部 | 履职评分42/100 → 建议PIP    [确认]│  │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 6. 后端 API 设计

### 6.1 核心接口

```
GET  /api/employees              # 员工列表（支持分页/筛选）
GET  /api/employees/{id}         # 员工详情
GET  /api/dashboard/stats        # Dashboard 统计数据
GET  /api/agents/status          # 四个 Agent 当前状态
POST /api/agents/trigger         # 手动触发 Agent 分析
GET  /api/decisions/pending      # 待审批决策列表
POST /api/decisions/{id}/approve # 确认决策
POST /api/decisions/{id}/reject  # 驳回决策
POST /api/monthly-meeting/start  # 启动月会流程
GET  /api/reports/daily          # 日报
GET  /api/reports/weekly         # 周报
GET  /api/reports/monthly        # 月报
GET  /api/stream/notifications   # SSE 实时推送
```

### 6.2 MiniMax API 集成

- 模型：`MiniMax-M2.7`
- 调用场景：分析 Agent（批量分析）、决策 Agent（生成建议摘要）
- API Key 通过环境变量 `MINIMAX_API_KEY` 注入，不硬编码
- 请求限流：批量分析时串行调用，避免超出 rate limit
- **容错策略：** 单次调用超时 30s，失败自动重试 2 次，重试后仍失败则降级为规则引擎（基于阈值的静态建议），并在 Dashboard 标注"AI 降级"

### 6.3 Decision 数据模型

```typescript
interface Decision {
  id: string
  employeeId: string
  employeeName: string
  type: 'promote' | 'salary_raise' | 'pip' | 'one_on_one'
  status: 'pending' | 'approved' | 'rejected' | 'deferred'
  reason: string
  confidence: number
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
  executionResult?: string
}
```

### 6.4 SSE 连接设计

- 每个客户端连接携带 `client_id`（前端生成 UUID），服务端按 client_id 管理连接
- 断线重连：前端使用 EventSource 自动重连，服务端保留最近 50 条事件供重连后补发
- Demo 场景下不做鉴权，生产环境需补充 token 验证

### 6.5 月会纪要

- Demo 阶段：生成结构化 JSON 摘要，前端渲染为可打印的 HTML 页面（非真实 PDF）
- 包含字段：会议日期、参与人、决议列表、执行状态汇总

---

## 7. 项目目录结构

```
绩效管理agent/
├── frontend/                    # Next.js 前端
│   ├── src/
│   │   ├── app/                 # App Router 页面
│   │   ├── components/          # 共享组件
│   │   │   ├── dashboard/       # Dashboard 组件
│   │   │   ├── agents/          # Agent 状态组件
│   │   │   └── ui/              # 基础 UI 组件
│   │   ├── lib/                 # 工具函数、API 客户端
│   │   └── types/               # TypeScript 类型定义
│   ├── package.json
│   └── tsconfig.json
├── backend/                     # Python FastAPI 后端
│   ├── agents/
│   │   ├── data_collector.py    # 数据采集 Agent
│   │   ├── analysis_agent.py    # 分析 Agent
│   │   ├── decision_agent.py    # 辅助决策 Agent
│   │   └── execution_agent.py  # 执行 Agent
│   ├── models/                  # Pydantic 数据模型
│   ├── routers/                 # FastAPI 路由
│   ├── services/                # 业务逻辑层
│   ├── data/                    # SQLite 数据库
│   ├── main.py                  # 入口文件
│   └── pyproject.toml
├── scripts/                     # 启停脚本
│   ├── start.sh                 # 启动前后端
│   ├── stop.sh                  # 停止服务
│   └── seed.sh                  # 初始化 mock 数据
├── logs/                        # 日志输出目录
├── docs/                        # 文档
└── .env.example                 # 环境变量模板
```

---

## 8. 关键交互流程

### 8.1 总经理确认流程

```
Agent 推送建议 → SSE 推送到 Dashboard
→ 总经理查看建议详情
→ 点击「确认」
→ 执行 Agent 接收指令
→ 更新 HR 系统（mock）
→ 写入操作日志
→ Dashboard 状态更新
```

### 8.2 月会自动化流程

```
总经理点击「启动月会」
→ 决策 Agent 汇总本月所有待决策事项
→ 生成月会议程（含每人建议 + 依据）
→ 总经理逐条确认/驳回
→ 执行 Agent 批量执行所有确认项
→ 生成月会纪要 PDF（mock）
→ 推送执行结果摘要
```

---

## 9. 非功能性要求

- **代码规范：** Python 文件 ≤300 行，TypeScript 文件 ≤300 行
- **类型安全：** 所有数据结构使用强类型，禁止 `any`
- **日志：** 所有 Agent 操作写入 `logs/` 目录，按日期分文件
- **环境变量：** API Key 等敏感信息通过 `.env` 管理，不提交到代码
- **启停：** 所有运行操作通过 `scripts/` 下的 `.sh` 脚本执行
