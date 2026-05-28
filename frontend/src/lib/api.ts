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

export async function fetchDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/dashboard/stats')
}

// ── Decisions ──────────────────────────────────────────────────────────────

interface PaginatedDecisions {
  items: Decision[]
  total: number
}

export async function fetchPendingDecisions(
  page = 1,
  size = 20,
): Promise<PaginatedDecisions> {
  return request<PaginatedDecisions>(
    `/decisions/pending?page=${page}&size=${size}`,
  )
}

export async function approveDecision(
  id: string,
  resolvedBy = '总经理',
): Promise<Decision> {
  return request<Decision>(`/decisions/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ resolved_by: resolvedBy }),
  })
}

export async function rejectDecision(id: string): Promise<Decision> {
  return request<Decision>(`/decisions/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

export async function deferDecision(id: string): Promise<Decision> {
  return request<Decision>(`/decisions/${id}/defer`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}

// ── Agents ─────────────────────────────────────────────────────────────────

export async function fetchAgentStatus(): Promise<AgentStatusInfo[]> {
  return request<AgentStatusInfo[]>('/agents/status')
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
  return request<PaginatedEmployees>(`/employees?${q.toString()}`)
}

export async function fetchEmployee(id: string): Promise<EmployeeRecord> {
  return request<EmployeeRecord>(`/employees/${id}`)
}

// ── Decision History ────────────────────────────────────────────────────────

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
  return request<PaginatedDecisionHistory>(`/decisions/history?${q.toString()}`)
}

// ── Monthly Meeting ─────────────────────────────────────────────────────────

export async function startMonthlyMeeting(): Promise<MeetingAgenda> {
  return request<MeetingAgenda>('/monthly-meeting/start', { method: 'POST', body: JSON.stringify({}) })
}

export async function getMonthlyMeetingAgenda(): Promise<MeetingAgenda> {
  return request<MeetingAgenda>('/monthly-meeting/agenda')
}

export async function confirmMeetingItem(
  decisionId: string,
  confirmed: boolean,
): Promise<MeetingAgendaItem> {
  return request<MeetingAgendaItem>('/monthly-meeting/confirm', {
    method: 'POST',
    body: JSON.stringify({ decision_id: decisionId, confirmed }),
  })
}

export async function finishMonthlyMeeting(): Promise<MeetingMinutes> {
  return request<MeetingMinutes>('/monthly-meeting/finish', { method: 'POST', body: JSON.stringify({}) })
}

// ── Reports ─────────────────────────────────────────────────────────────────

export async function fetchReport(type: 'daily' | 'weekly' | 'monthly'): Promise<Report> {
  return request<Report>(`/reports/${type}`)
}

export { ApiError, BASE_URL }
