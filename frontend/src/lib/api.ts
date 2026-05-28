/**
 * API 客户端封装
 * baseURL 通过 Next.js rewrites 代理到 localhost:8000
 */

import type {
  DashboardStats,
  Decision,
  AgentStatusInfo,
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
  await request<void>(`/agents/${agent}/trigger`, {
    method: 'POST',
    body: JSON.stringify({ scope }),
  })
}

export { ApiError, BASE_URL }
