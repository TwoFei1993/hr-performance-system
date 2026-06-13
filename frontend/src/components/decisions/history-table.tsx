'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Decision, DecisionType, DecisionStatus } from '@/types'

interface HistoryTableProps {
  history: Decision[]
}

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

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning' | 'info'

const STATUS_VARIANT: Record<DecisionStatus, BadgeVariant> = {
  pending: 'default',
  approved: 'success',
  rejected: 'danger',
  deferred: 'warning',
}

const TYPE_VARIANT: Record<DecisionType, BadgeVariant> = {
  promote: 'info',
  salary_raise: 'success',
  pip: 'danger',
  one_on_one: 'warning',
}

type FilterType = DecisionType | 'all'

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'promote', label: '升职' },
  { value: 'salary_raise', label: '调薪' },
  { value: 'pip', label: 'PIP' },
  { value: 'one_on_one', label: '1:1' },
]

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function HistoryTable({ history }: HistoryTableProps) {
  const [filter, setFilter] = useState<FilterType>('all')

  const filtered = filter === 'all' ? history : history.filter((d) => d.type === filter)

  return (
    <div className="space-y-3">
      {/* 筛选栏 */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 font-medium">按类型筛选：</span>
        <div className="flex gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-xs text-slate-400">{filtered.length} 条记录</span>
      </div>

      {/* 表格 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                员工
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                部门
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                建议类型
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                处理结果
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                处理时间
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                执行结果
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{d.employeeName}</td>
                <td className="px-4 py-3 text-slate-500">{d.department}</td>
                <td className="px-4 py-3">
                  <Badge variant={TYPE_VARIANT[d.type]}>{TYPE_LABEL[d.type]}</Badge>
                </td>
                <td className="px-4 py-3">
                  <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                </td>
                <td className="px-4 py-3 text-slate-500 tabular-nums text-xs">
                  {formatDate(d.resolvedAt)}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-48 truncate">
                  {d.executionResult ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">暂无处理记录</div>
        )}
      </div>
    </div>
  )
}
