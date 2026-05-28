'use client'

import { useEffect, useState, useCallback } from 'react'
import { DecisionCard } from '@/components/decisions/decision-card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import {
  fetchPendingDecisions,
  fetchDecisionHistory,
  approveDecision,
  rejectDecision,
  deferDecision,
} from '@/lib/api'
import type { Decision, DecisionType, DecisionStatus } from '@/types'

type Tab = 'pending' | 'history'

const TYPE_LABEL: Record<DecisionType, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: 'PIP',
  one_on_one: '1:1',
}

const STATUS_LABEL: Record<DecisionStatus, string> = {
  pending: '待审批',
  approved: '已确认',
  rejected: '已驳回',
  deferred: '已暂缓',
}

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning'

const STATUS_VARIANT: Record<DecisionStatus, BadgeVariant> = {
  pending: 'default',
  approved: 'success',
  rejected: 'danger',
  deferred: 'warning',
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

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
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">决策审批</h1>
          <p className="text-sm text-slate-500 mt-0.5">AI 辅助决策，人工最终确认</p>
        </div>
        {pending.length > 0 && (
          <Badge variant="danger">{pending.length} 待审批</Badge>
        )}
      </div>

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
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'pending' ? `待审批 (${pending.length})` : '已处理'}
          </button>
        ))}
      </div>

      {tab === 'pending' && (
        loadingPending ? <PageLoading /> : (
          pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <span className="text-4xl mb-3">✅</span>
              <p className="text-sm">暂无待审批决策</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {pending.map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onDefer={handleDefer}
                  processing={processing === d.id}
                />
              ))}
            </div>
          )
        )
      )}

      {tab === 'history' && (
        loadingHistory ? <PageLoading /> : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">员工</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">类型</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">处理时间</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {history.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.employeeName}</td>
                    <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[d.type]}</td>
                    <td className="px-4 py-3 text-slate-500 tabular-nums">{formatDate(d.resolvedAt)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {history.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">暂无处理记录</div>
            )}
          </div>
        )
      )}
    </div>
  )
}
