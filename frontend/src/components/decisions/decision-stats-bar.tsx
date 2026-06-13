import type { Decision, DecisionType } from '@/types'

interface StatsBarProps {
  pending: Decision[]
  history: Decision[]
}

interface StatCard {
  label: string
  value: string | number
  sub?: string
  accent: string
}

function calcAvgConfidence(items: Decision[]): string {
  if (items.length === 0) return '—'
  const avg = items.reduce((s, d) => s + d.confidence, 0) / items.length
  return `${Math.round(avg * 100)}%`
}

function todayCount(items: Decision[]): number {
  const today = new Date().toDateString()
  return items.filter((d) => new Date(d.createdAt).toDateString() === today).length
}

function thisMonthResolved(items: Decision[]): number {
  const now = new Date()
  return items.filter((d) => {
    if (!d.resolvedAt) return false
    const r = new Date(d.resolvedAt)
    return r.getFullYear() === now.getFullYear() && r.getMonth() === now.getMonth()
  }).length
}

const TYPE_LABEL: Record<DecisionType, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: 'PIP',
  one_on_one: '1:1',
}

export function DecisionStatsBar({ pending, history }: StatsBarProps) {
  const typeBreakdown = (['promote', 'salary_raise', 'pip', 'one_on_one'] as DecisionType[])
    .map((t) => `${TYPE_LABEL[t]} ${pending.filter((d) => d.type === t).length}`)
    .join(' · ')

  const stats: StatCard[] = [
    {
      label: '待审批总数',
      value: pending.length,
      sub: typeBreakdown,
      accent: 'text-indigo-600',
    },
    {
      label: '今日新增',
      value: todayCount(pending),
      sub: '待处理决策',
      accent: 'text-amber-600',
    },
    {
      label: '本月已处理',
      value: thisMonthResolved(history),
      sub: `共 ${history.length} 条历史`,
      accent: 'text-emerald-600',
    },
    {
      label: '平均置信度',
      value: calcAvgConfidence(pending),
      sub: '待审批决策',
      accent: 'text-slate-700',
    },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-4"
        >
          <p className="text-xs text-slate-500 font-medium">{s.label}</p>
          <p className={`text-2xl font-bold tabular-nums mt-1 ${s.accent}`}>
            {s.value}
          </p>
          {s.sub && (
            <p className="text-xs text-slate-400 mt-1 truncate">{s.sub}</p>
          )}
        </div>
      ))}
    </div>
  )
}
