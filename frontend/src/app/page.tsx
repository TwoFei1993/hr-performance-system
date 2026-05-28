'use client'

import { useEffect, useState, useCallback } from 'react'
import { KPICards } from '@/components/dashboard/kpi-cards'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { DepartmentRadar } from '@/components/dashboard/department-radar'
import { NotificationList } from '@/components/dashboard/notification-list'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { useSSE } from '@/lib/use-sse'
import {
  fetchDashboardStats,
  fetchPendingDecisions,
  approveDecision,
  rejectDecision,
} from '@/lib/api'
import type { DashboardStats, Decision } from '@/types'

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingDecisions, setLoadingDecisions] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  const { events, isConnected } = useSSE()

  // 加载 Dashboard 统计数据
  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDashboardStats()
      setStats(data)
      setStatsError(null)
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingStats(false)
    }
  }, [])

  // 加载待审批决策
  const loadDecisions = useCallback(async () => {
    setLoadingDecisions(true)
    try {
      const result = await fetchPendingDecisions(1, 50)
      setDecisions(result.items)
    } catch {
      // 静默失败，保留旧数据
    } finally {
      setLoadingDecisions(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
    void loadDecisions()
  }, [loadStats, loadDecisions])

  // SSE 事件触发刷新
  useEffect(() => {
    const latest = events[events.length - 1]
    if (!latest) return
    if (latest.type === 'decision_created' || latest.type === 'decision_updated') {
      void loadDecisions()
      void loadStats()
    }
  }, [events, loadDecisions, loadStats])

  // 乐观更新：确认决策
  const handleApprove = useCallback(async (id: string) => {
    const prev = decisions
    setDecisions((d) => d.filter((item) => item.id !== id))
    try {
      await approveDecision(id)
      void loadStats()
    } catch {
      setDecisions(prev)
    }
  }, [decisions, loadStats])

  // 乐观更新：驳回决策
  const handleReject = useCallback(async (id: string) => {
    const prev = decisions
    setDecisions((d) => d.filter((item) => item.id !== id))
    try {
      await rejectDecision(id)
      void loadStats()
    } catch {
      setDecisions(prev)
    }
  }, [decisions, loadStats])

  if (loadingStats && !stats) {
    return <PageLoading />
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* 页面标题栏 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">绩效管理中心</h1>
          <p className="text-sm text-slate-500 mt-0.5">总经理视角</p>
        </div>
        <div className="flex items-center gap-3">
          {/* SSE 连接状态 */}
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}
              aria-label={isConnected ? 'Agent 实时连接中' : 'Agent 未连接'}
            />
            <span className="text-xs text-slate-400">
              {isConnected ? '实时' : '离线'}
            </span>
          </div>
          {decisions.length > 0 && (
            <Badge variant="danger">{decisions.length} 待审批</Badge>
          )}
          <Button variant="primary" size="md">
            启动月会
          </Button>
        </div>
      </div>

      {statsError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          数据加载失败：{statsError}
        </div>
      )}

      {/* KPI 卡片 */}
      {stats && <KPICards stats={stats} />}

      {/* 图表行 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <PerformanceChart data={stats.scoreDistribution} />
          </div>
          <div className="col-span-1">
            <DepartmentRadar data={stats.departmentScores} />
          </div>
        </div>
      )}

      {/* 待审批决策列表 */}
      <NotificationList
        decisions={decisions}
        onApprove={handleApprove}
        onReject={handleReject}
        loading={loadingDecisions}
      />
    </div>
  )
}
