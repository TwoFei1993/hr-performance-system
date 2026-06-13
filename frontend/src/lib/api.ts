/**
 * API 客户端封装
 * baseURL 通过 Next.js rewrites 代理到 localhost:8000
 */

import type {
  DashboardStats,
  Decision,
  AgentStatusInfo,
  EmployeeRecord,
  MeetingAgenda,
  MeetingAgendaItem,
  MeetingMinutes,
  Report,
} from '@/types'

const BASE_URL = '/api'

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${BASE_URL}${path}`
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `HTTP ${response.status}: ${response.statusText}`,
    )
  }

  return response.json() as Promise<T>
}

// ── Dashboard ──────────────────────────────────────────────────────────────

interface RawDashboardStats {
  total_employees: number
  pending_promote: number
  pending_salary_raise: number
  pending_pip: number
  pending_one_on_one: number
  department_scores: Record<string, number>
  department_6d_scores?: Record<string, Record<string, number>>
  score_distribution: Array<{ range: string; count: number }>
}

export async function fetchDashboardStats(department?: string): Promise<DashboardStats> {
  const params = department ? `?department=${encodeURIComponent(department)}` : ''
  const raw = await request<RawDashboardStats>(`/dashboard/stats${params}`)
  return {
    totalEmployees: raw.total_employees,
    pendingPromote: raw.pending_promote,
    pendingSalaryRaise: raw.pending_salary_raise,
    pendingPip: raw.pending_pip,
    pendingOneOnOne: raw.pending_one_on_one,
    departmentScores: raw.department_scores as DashboardStats['departmentScores'],
    department6dScores: raw.department_6d_scores ?? {},
    scoreDistribution: raw.score_distribution,
  }
}

// ── Decisions ──────────────────────────────────────────────────────────────

interface RawDecision {
  id: string
  employee_id: string
  employee_name: string
  department: string
  type: string
  status: string
  reason: string
  confidence: number
  created_at: string
  resolved_at?: string
  resolved_by?: string
  execution_result?: string
}

function mapDecision(raw: RawDecision): Decision {
  return {
    id: raw.id,
    employeeId: raw.employee_id,
    employeeName: raw.employee_name,
    department: raw.department as Decision['department'],
    type: raw.type as Decision['type'],
    status: raw.status as Decision['status'],
    reason: raw.reason,
    confidence: raw.confidence,
    createdAt: raw.created_at,
    resolvedAt: raw.resolved_at,
    resolvedBy: raw.resolved_by,
    executionResult: raw.execution_result,
  }
}

interface RawPaginatedDecisions {
  items: RawDecision[]
  total: number
}

interface PaginatedDecisions {
  items: Decision[]
  total: number
}

export async function fetchPendingDecisions(
  page = 1,
  size = 20,
): Promise<PaginatedDecisions> {
  const raw = await request<RawPaginatedDecisions>(
    `/decisions/pending?page=${page}&size=${size}`,
  )
  return { items: raw.items.map(mapDecision), total: raw.total }
}

export async function approveDecision(
  id: string,
  resolvedBy = '总经理',
): Promise<Decision> {
  const raw = await request<RawDecision>(`/decisions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ resolved_by: resolvedBy }),
  })
  return mapDecision(raw)
}

export async function rejectDecision(id: string): Promise<Decision> {
  const raw = await request<RawDecision>(`/decisions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return mapDecision(raw)
}

export async function deferDecision(id: string): Promise<Decision> {
  const raw = await request<RawDecision>(`/decisions/${id}/defer`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return mapDecision(raw)
}

// ── Agents ─────────────────────────────────────────────────────────────────

interface RawAgentStatusInfo {
  agent_name: string
  status: string
  last_run_at?: string
  next_run_at?: string
  run_count: number
  last_error?: string
}

export async function fetchAgentStatus(): Promise<AgentStatusInfo[]> {
  const raw = await request<RawAgentStatusInfo[]>('/agents/status')
  return raw.map((r) => ({
    agentName: r.agent_name as AgentStatusInfo['agentName'],
    status: r.status as AgentStatusInfo['status'],
    lastRunAt: r.last_run_at,
    nextRunAt: r.next_run_at,
    runCount: r.run_count,
  }))
}

export async function triggerAgent(
  agent: string,
  scope: string,
): Promise<void> {
  await request<void>('/agents/trigger', {
    method: 'POST',
    body: JSON.stringify({ agent, scope }),
  })
}

// ── Employees ──────────────────────────────────────────────────────────────

interface RawEmployeeRecord {
  id: string
  name: string
  department: string
  level: string
  manager?: string
  okr_score: number
  review_score_360: number
  business_score: number
  attendance_score: number
  composite_score: number
  score_history: number[]
  recommendation: string
  trend: string
  hire_date: string
  recommendation_reason: string
  confidence?: number
  is_ai_degraded?: boolean
}

function mapEmployee(raw: RawEmployeeRecord): EmployeeRecord {
  return {
    id: raw.id,
    name: raw.name,
    department: raw.department as EmployeeRecord['department'],
    level: raw.level as EmployeeRecord['level'],
    manager: raw.manager ?? '',
    okrScore: raw.okr_score,
    reviewScore360: raw.review_score_360,
    businessScore: raw.business_score,
    attendanceScore: raw.attendance_score,
    compositeScore: raw.composite_score,
    scoreHistory: raw.score_history ?? [],
    recommendation: raw.recommendation as EmployeeRecord['recommendation'],
    trend: raw.trend as EmployeeRecord['trend'],
    hireDate: raw.hire_date,
    recommendationReason: raw.recommendation_reason,
    confidence: raw.confidence ?? 0,
    isAiDegraded: raw.is_ai_degraded,
  }
}

interface RawPaginatedEmployees {
  items: RawEmployeeRecord[]
  total: number
  page: number
  size: number
}

interface PaginatedEmployees {
  items: EmployeeRecord[]
  total: number
  page: number
  size: number
}

export async function fetchEmployees(params: {
  page?: number
  size?: number
  department?: string
  recommendation?: string
  sortBy?: string
  order?: string
}): Promise<PaginatedEmployees> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  if (params.department) q.set('department', params.department)
  if (params.recommendation) q.set('recommendation', params.recommendation)
  if (params.sortBy) q.set('sort_by', params.sortBy)
  if (params.order) q.set('order', params.order)
  const raw = await request<RawPaginatedEmployees>(`/employees?${q.toString()}`)
  return {
    items: raw.items.map(mapEmployee),
    total: raw.total,
    page: raw.page,
    size: raw.size,
  }
}

export async function fetchEmployee(id: string): Promise<EmployeeRecord> {
  const raw = await request<RawEmployeeRecord>(`/employees/${id}`)
  return mapEmployee(raw)
}

// ── Decision History ────────────────────────────────────────────────────────

interface RawPaginatedDecisionHistory {
  items: RawDecision[]
  total: number
}

interface PaginatedDecisionHistory {
  items: Decision[]
  total: number
}

export async function fetchDecisionHistory(params: {
  page?: number
  size?: number
  status?: string
}): Promise<PaginatedDecisionHistory> {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.size) q.set('size', String(params.size))
  if (params.status) q.set('status', params.status)
  const raw = await request<RawPaginatedDecisionHistory>(`/decisions/history?${q.toString()}`)
  return { items: raw.items.map(mapDecision), total: raw.total }
}

// ── Monthly Meeting ─────────────────────────────────────────────────────────

interface RawMeetingAgendaItem {
  decision: RawDecision
  order: number
  confirmed: boolean | null
}

interface RawMeetingAgenda {
  id: string
  date: string
  total_items: number
  items: RawMeetingAgendaItem[]
  summary: string
  status: 'in_progress' | 'finished'
}

function mapMeetingAgenda(raw: RawMeetingAgenda): MeetingAgenda {
  return {
    id: raw.id,
    date: raw.date,
    totalItems: raw.total_items,
    items: raw.items.map((item) => ({
      decision: mapDecision(item.decision),
      order: item.order,
      confirmed: item.confirmed,
    })),
    summary: raw.summary,
    status: raw.status,
  }
}

interface RawMeetingMinutes {
  id: string
  date: string
  total_decisions: number
  approved_count: number
  rejected_count: number
  deferred_count: number
  decisions: RawDecision[]
  execution_results: Array<{ decision_id: string; result: string }>
  generated_at: string
}

function mapMeetingMinutes(raw: RawMeetingMinutes): MeetingMinutes {
  return {
    id: raw.id,
    date: raw.date,
    totalDecisions: raw.total_decisions,
    approvedCount: raw.approved_count,
    rejectedCount: raw.rejected_count,
    deferredCount: raw.deferred_count,
    decisions: raw.decisions.map(mapDecision),
    executionResults: raw.execution_results.map((r) => ({
      decisionId: r.decision_id,
      result: r.result,
    })),
    generatedAt: raw.generated_at,
  }
}

export async function startMonthlyMeeting(): Promise<MeetingAgenda> {
  const raw = await request<RawMeetingAgenda>('/monthly-meeting/start', { method: 'POST', body: JSON.stringify({}) })
  return mapMeetingAgenda(raw)
}

export async function getMonthlyMeetingAgenda(): Promise<MeetingAgenda> {
  const raw = await request<RawMeetingAgenda>('/monthly-meeting/agenda')
  return mapMeetingAgenda(raw)
}

export async function confirmMeetingItem(
  decisionId: string,
  confirmed: boolean,
): Promise<MeetingAgendaItem> {
  const raw = await request<RawMeetingAgendaItem>('/monthly-meeting/confirm', {
    method: 'POST',
    body: JSON.stringify({ decision_id: decisionId, confirmed }),
  })
  return { decision: mapDecision(raw.decision), order: raw.order, confirmed: raw.confirmed }
}

export async function finishMonthlyMeeting(): Promise<MeetingMinutes> {
  const raw = await request<RawMeetingMinutes>('/monthly-meeting/finish', { method: 'POST', body: JSON.stringify({}) })
  return mapMeetingMinutes(raw)
}

// ── Reports ─────────────────────────────────────────────────────────────────

interface RawReport {
  id: string
  type: string
  generated_at: string
  summary: string
  content: Record<string, unknown>
  employee_count: number
  decision_count: number
}

export async function fetchReport(type: 'daily' | 'weekly' | 'monthly'): Promise<Report> {
  const raw = await request<RawReport>(`/reports/${type}`)
  return {
    id: raw.id,
    type: raw.type as Report['type'],
    generatedAt: raw.generated_at,
    summary: raw.summary,
    content: raw.content,
    employeeCount: raw.employee_count,
    decisionCount: raw.decision_count,
  }
}

interface RawReportList {
  items: RawReport[]
  total: number
}

export async function fetchMonthlyReports(size = 12): Promise<Report[]> {
  try {
    const raw = await request<RawReportList>(`/reports/monthly/list?size=${size}`)
    return raw.items.map((r) => ({
      id: r.id,
      type: r.type as Report['type'],
      generatedAt: r.generated_at,
      summary: r.summary,
      content: r.content,
      employeeCount: r.employee_count,
      decisionCount: r.decision_count,
    }))
  } catch {
    // 如果接口不存在，静默返回空数组
    return []
  }
}

export async function resetDemo(): Promise<{ message: string }> {
  const resp = await fetch(`${BASE_URL}/reset`, { method: 'POST' })
  if (!resp.ok) throw new ApiError(resp.status, '复位失败')
  return resp.json() as Promise<{ message: string }>
}

export { ApiError, BASE_URL }
