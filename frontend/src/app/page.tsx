'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Wifi, WifiOff, RotateCcw } from 'lucide-react'
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
  resetDemo,
} from '@/lib/api'
import type { DashboardStats, Decision } from '@/types'

export default function DashboardPage() {
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingDecisions, setLoadingDecisions] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [selectedDept, setSelectedDept] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)

  const { events, isConnected } = useSSE()

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchDashboardStats(selectedDept ?? undefined)
      setStats(data)
      setStatsError(null)
    } catch (err) {
      setStatsError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingStats(false)
    }
  }, [selectedDept])

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

  useEffect(() => {
    const latest = events[events.length - 1]
    if (!latest) return
    if (latest.type === 'decision_created' || latest.type === 'decision_updated') {
      void loadDecisions()
      void loadStats()
    }
  }, [events, loadDecisions, loadStats])

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

  const handleReset = useCallback(async () => {
    if (!window.confirm('确认复位？这将清空所有决策并重新生成员工数据。')) return
    setResetting(true)
    try {
      await resetDemo()
      window.location.reload()
    } catch {
      setResetting(false)
    }
  }, [])

  if (loadingStats && !stats) {
    return <PageLoading />
  }

  return (
    <div className="px-5 py-5 space-y-6">
      {/* 页面标题栏 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">绩效管理中心</h1>
          <p className="text-sm text-slate-500 mt-1">总经理视角 · 实时数据看板</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* SSE 连接状态 */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isConnected
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}
            aria-label={isConnected ? 'Agent 实时连接中' : 'Agent 未连接'}
          >
            {isConnected ? (
              <>
                <span className="relative flex w-2 h-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full w-2 h-2 bg-emerald-500" />
                </span>
                <Wifi className="w-3 h-3" aria-hidden="true" />
                <span>实时同步</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                <WifiOff className="w-3 h-3" aria-hidden="true" />
                <span>离线</span>
              </>
            )}
          </div>
          {decisions.length > 0 && (
            <Badge variant="danger">{decisions.length} 待审批</Badge>
          )}
          <Button variant="danger" size="md" loading={resetting} onClick={() => void handleReset()}>
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            复位
          </Button>
          <Button variant="primary" size="md" data-testid="start-meeting-btn" onClick={() => router.push('/monthly-meeting')}>
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            月会
          </Button>
        </div>
      </div>

      {/* 部门筛选栏 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500">筛选部门：</span>
        {['全公司', '研发', '销售', '运营', '财务', '市场', 'HR'].map((dept) => (
          <button
            key={dept}
            type="button"
            onClick={() => setSelectedDept(dept === '全公司' ? null : dept)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              (dept === '全公司' && !selectedDept) || selectedDept === dept
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {dept}
          </button>
        ))}
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
            <DepartmentRadar data={stats.department6dScores ?? {}} />
          </div>
        </div>
      )}

      {/* 待审批决策列表 */}
      <div data-testid="notification-list">
        <NotificationList
          decisions={decisions}
          onApprove={handleApprove}
          onReject={handleReject}
          loading={loadingDecisions}
        />
      </div>
    </div>
  )
}
