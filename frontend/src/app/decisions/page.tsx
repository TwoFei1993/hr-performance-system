'use client'

import { useEffect, useState, useCallback } from 'react'
import { DecisionStatsBar } from '@/components/decisions/decision-stats-bar'
import { GroupedPendingList } from '@/components/decisions/grouped-pending-list'
import { HistoryTable } from '@/components/decisions/history-table'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import {
  fetchPendingDecisions,
  fetchDecisionHistory,
  approveDecision,
  rejectDecision,
  deferDecision,
} from '@/lib/api'
import type { Decision } from '@/types'

type Tab = 'pending' | 'history'

export default function DecisionsPage() {
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<Decision[]>([])
  const [history, setHistory] = useState<Decision[]>([])
  const [loadingPending, setLoadingPending] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPending = useCallback(async () => {
    setLoadingPending(true)
    try {
      const r = await fetchPendingDecisions(1, 50)
      setPending(r.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingPending(false)
    }
  }, [])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const r = await fetchDecisionHistory({ page: 1, size: 50 })
      setHistory(r.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  useEffect(() => { void loadPending() }, [loadPending])
  useEffect(() => { if (tab === 'history') void loadHistory() }, [tab, loadHistory])

  const handleApprove = useCallback(async (id: string) => {
    setProcessing(id)
    try { await approveDecision(id); await loadPending() }
    catch (err) { setError(err instanceof Error ? err.message : '操作失败') }
    finally { setProcessing(null) }
  }, [loadPending])

  const handleReject = useCallback(async (id: string) => {
    setProcessing(id)
    try { await rejectDecision(id); await loadPending() }
    catch (err) { setError(err instanceof Error ? err.message : '操作失败') }
    finally { setProcessing(null) }
  }, [loadPending])

  const handleDefer = useCallback(async (id: string) => {
    setProcessing(id)
    try { await deferDecision(id); await loadPending() }
    catch (err) { setError(err instanceof Error ? err.message : '操作失败') }
    finally { setProcessing(null) }
  }, [loadPending])

  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">决策审批</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI 辅助决策，人工最终确认</p>
        </div>
        {pending.length > 0 && (
          <Badge variant="danger">{pending.length} 待审批</Badge>
        )}
      </div>

      {/* 统计栏 */}
      {!loadingPending && (
        <DecisionStatsBar pending={pending} history={history} />
      )}

      {/* 错误提示 */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        {(['pending', 'history'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${
              tab === t
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'pending' ? `待审批 (${pending.length})` : '已处理'}
          </button>
        ))}
      </div>

      {/* 待审批 */}
      {tab === 'pending' && (
        loadingPending ? <PageLoading /> : (
          pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-sm">暂无待审批决策</p>
            </div>
          ) : (
            <GroupedPendingList
              decisions={pending}
              onApprove={handleApprove}
              onReject={handleReject}
              onDefer={handleDefer}
              processing={processing}
            />
          )
        )
      )}

      {/* 已处理 */}
      {tab === 'history' && (
        loadingHistory ? <PageLoading /> : (
          <HistoryTable history={history} />
        )
      )}
    </div>
  )
}
