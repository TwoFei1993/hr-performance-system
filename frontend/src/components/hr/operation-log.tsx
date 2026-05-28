import { Badge } from '@/components/ui/badge'
import type { Decision, DecisionType } from '@/types'

interface OperationLogProps {
  decisions: Decision[]
  loading?: boolean
}

const TYPE_LABEL: Record<DecisionType, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: 'PIP',
  one_on_one: '1:1',
}

type BadgeVariant = 'info' | 'success' | 'danger' | 'warning'

const TYPE_VARIANT: Record<DecisionType, BadgeVariant> = {
  promote: 'info',
  salary_raise: 'success',
  pip: 'danger',
  one_on_one: 'warning',
}

function formatDate(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch { return iso }
}

export function OperationLog({ decisions, loading }: OperationLogProps) {
  if (loading) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">加载中...</div>
    )
  }

  if (decisions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <span className="text-4xl mb-3">🏢</span>
        <p className="text-sm">暂无执行记录</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table" aria-label="HR 操作执行记录">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">员工</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">部门</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作类型</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">执行时间</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">执行结果</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {decisions.map((d) => (
            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 font-medium text-slate-900">{d.employeeName}</td>
              <td className="px-4 py-3 text-slate-600">{d.department}</td>
              <td className="px-4 py-3">
                <Badge variant={TYPE_VARIANT[d.type]}>{TYPE_LABEL[d.type]}</Badge>
              </td>
              <td className="px-4 py-3 text-slate-500 tabular-nums">{formatDate(d.resolvedAt)}</td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {d.executionResult ?? '已执行'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
