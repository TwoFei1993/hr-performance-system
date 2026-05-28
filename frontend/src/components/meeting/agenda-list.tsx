'use client'

import { Badge } from '@/components/ui/badge'
import type { MeetingAgendaItem, DecisionType } from '@/types'

interface AgendaListProps {
  items: MeetingAgendaItem[]
  onConfirm: (decisionId: string, confirmed: boolean) => void
  processing?: string | null
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

export function AgendaList({ items, onConfirm, processing }: AgendaListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        暂无议程项目
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isProcessing = processing === item.decision.id
        const confirmed = item.confirmed

        return (
          <div
            key={item.decision.id}
            className={`bg-white rounded-xl border shadow-sm p-4 transition-all ${
              confirmed === true
                ? 'border-emerald-200 bg-emerald-50/30'
                : confirmed === false
                ? 'border-red-200 bg-red-50/30'
                : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  <span className="text-xs text-slate-400 tabular-nums">#{item.order}</span>
                  <span className="text-sm font-semibold text-slate-900">{item.decision.employeeName}</span>
                  <span className="text-xs text-slate-400">{item.decision.department}</span>
                  <Badge variant={TYPE_VARIANT[item.decision.type]}>
                    {TYPE_LABEL[item.decision.type]}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                  {item.decision.reason}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => onConfirm(item.decision.id, true)}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    confirmed === true
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700'
                  } disabled:opacity-50`}
                  aria-label={`确认 ${item.decision.employeeName} 的 ${TYPE_LABEL[item.decision.type]} 建议`}
                >
                  确认
                </button>
                <button
                  onClick={() => onConfirm(item.decision.id, false)}
                  disabled={isProcessing}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    confirmed === false
                      ? 'bg-red-600 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700'
                  } disabled:opacity-50`}
                  aria-label={`驳回 ${item.decision.employeeName} 的 ${TYPE_LABEL[item.decision.type]} 建议`}
                >
                  驳回
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
