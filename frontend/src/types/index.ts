export type Department = '研发' | '销售' | '运营' | '财务' | '市场' | 'HR'
export type Level = 'P4' | 'P5' | 'P6' | 'P7' | 'P8' | 'P9'
export type Trend = 'up' | 'down' | 'stable'
export type Recommendation = 'promote' | 'salary_raise' | 'pip' | 'one_on_one' | 'normal'
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'deferred'
export type DecisionType = 'promote' | 'salary_raise' | 'pip' | 'one_on_one'
export type AgentName = 'data_collector' | 'analysis' | 'decision' | 'execution'
export type AgentStatus = 'idle' | 'running' | 'error'
export type ReportType = 'daily' | 'weekly' | 'monthly'

export interface EmployeeRecord {
  id: string
  name: string
  department: Department
  level: Level
  manager: string
  hireDate: string
  okrScore: number
  reviewScore360: number
  businessScore: number
  attendanceScore: number
  compositeScore: number
  scoreHistory: number[]
  trend: Trend
  recommendation: Recommendation
  recommendationReason: string
  confidence: number
  isAiDegraded?: boolean
}

export interface Decision {
  id: string
  employeeId: string
  employeeName: string
  department: Department
  type: DecisionType
  status: DecisionStatus
  reason: string
  confidence: number
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
  executionResult?: string
}

export interface AgentStatusInfo {
  agentName: AgentName
  status: AgentStatus
  lastRunAt?: string
  nextRunAt?: string
  runCount: number
}

export interface DashboardStats {
  totalEmployees: number
  pendingPromote: number
  pendingSalaryRaise: number
  pendingPip: number
  pendingOneOnOne: number
  departmentScores: Record<Department, number>
  scoreDistribution: Array<{ range: string; count: number }>
}

export interface SSEEvent {
  id: string
  type: 'decision_created' | 'decision_updated' | 'agent_status' | 'report_ready'
  data: unknown
  timestamp: string
}

export interface MeetingAgendaItem {
  decision: Decision
  order: number
  confirmed: boolean | null
}

export interface MeetingAgenda {
  id: string
  date: string
  totalItems: number
  items: MeetingAgendaItem[]
  summary: string
  status: 'in_progress' | 'finished'
}

export interface MeetingMinutes {
  id: string
  date: string
  totalDecisions: number
  approvedCount: number
  rejectedCount: number
  deferredCount: number
  decisions: Decision[]
  executionResults: Array<{ decisionId: string; result: string }>
  generatedAt: string
}

export interface Report {
  id: string
  type: ReportType
  generatedAt: string
  summary: string
  content: Record<string, unknown>
  employeeCount: number
  decisionCount: number
}
