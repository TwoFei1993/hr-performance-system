import { Badge } from '@/components/ui/badge'
import type { MeetingMinutes, DecisionType, DecisionStatus } from '@/types'

interface MeetingMinutesProps {
  minutes: MeetingMinutes
}

const TYPE_LABEL: Record<DecisionType, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: 'PIP',
  one_on_one: '1:1',
}

type BadgeVariant = 'default' | 'success' | 'danger' | 'warning'

const STATUS_VARIANT: Record<DecisionStatus, BadgeVariant> = {
  pending: 'default',
  approved: 'success',
  rejected: 'danger',
  deferred: 'warning',
}

const STATUS_LABEL: Record<DecisionStatus, string> = {
  pending: '待处理',
  approved: '已确认',
  rejected: '已驳回',
  deferred: '已暂缓',
}

function formatDate(iso: string): string {
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

export function MeetingMinutesView({ minutes }: MeetingMinutesProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">月会纪要</h2>
          <p className="text-xs text-slate-400 mt-0.5">生成于 {formatDate(minutes.generatedAt)}</p>
        </div>
      </div>

      {/* 统计数字 */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: '总决策', value: minutes.totalDecisions, color: 'text-slate-700' },
          { label: '已确认', value: minutes.approvedCount, color: 'text-emerald-600' },
          { label: '已驳回', value: minutes.rejectedCount, color: 'text-red-600' },
          { label: '已暂缓', value: minutes.deferredCount, color: 'text-amber-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-slate-50 rounded-xl px-4 py-3 text-center border border-slate-100">
            <p className={`text-2xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* 决议列表 */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">决议列表</h3>
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">员工</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">类型</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">结果</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase">执行结果</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {minutes.decisions.map((d) => {
                const execResult = minutes.executionResults.find((r) => r.decisionId === d.id)
                return (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-900">{d.employeeName}</td>
                    <td className="px-4 py-3 text-slate-600">{TYPE_LABEL[d.type]}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[d.status]}>{STATUS_LABEL[d.status]}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{execResult?.result ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {minutes.decisions.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">暂无决议</div>
          )}
        </div>
      </div>
    </div>
  )
}
