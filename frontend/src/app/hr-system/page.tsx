'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { OperationLog } from '@/components/hr/operation-log'
import { fetchDecisionHistory } from '@/lib/api'
import type { Decision } from '@/types'

export default function HrSystemPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDecisionHistory({ page: 1, size: 100, status: 'approved' })
      setDecisions(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // 本月执行数（当月）
  const now = new Date()
  const thisMonthCount = decisions.filter((d) => {
    if (!d.resolvedAt) return false
    const date = new Date(d.resolvedAt)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">HR 系统</h1>
          <p className="text-sm text-slate-500 mt-0.5">操作执行记录</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          数据加载失败：{error}
        </div>
      )}

      {/* 顶部统计 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs text-slate-500 mb-1">本月执行操作</p>
          <p className="text-2xl font-bold text-blue-600 tabular-nums">{thisMonthCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs text-slate-500 mb-1">累计执行操作</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums">{total}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4">
          <p className="text-xs text-slate-500 mb-1">系统状态</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">正常运行</span>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>执行记录（已确认决策）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <OperationLog decisions={decisions} loading={loading} />
        </CardContent>
      </Card>
    </div>
  )
}
