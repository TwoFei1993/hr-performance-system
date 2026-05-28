'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Decision, DecisionType } from '@/types'

interface DecisionCardProps {
  decision: Decision
  onApprove?: (id: string) => void
  onReject?: (id: string) => void
  onDefer?: (id: string) => void
  processing?: boolean
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

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'bg-emerald-500'
  if (c >= 0.6) return 'bg-amber-400'
  return 'bg-red-400'
}

function formatDate(iso: string): string {
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

export function DecisionCard({
  decision,
  onApprove,
  onReject,
  onDefer,
  processing,
}: DecisionCardProps) {
  const pct = Math.round(decision.confidence * 100)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900">{decision.employeeName}</span>
            <span className="text-xs text-slate-400">{decision.department}</span>
            <Badge variant={TYPE_VARIANT[decision.type]}>
              {TYPE_LABEL[decision.type]}
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">{formatDate(decision.createdAt)}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-400 mb-1">置信度</p>
          <p className="text-sm font-bold tabular-nums text-slate-700">{pct}%</p>
        </div>
      </div>

      <div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-3">
          <div
            className={`h-full rounded-full ${confidenceColor(decision.confidence)}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          />
        </div>
        <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
          {decision.reason}
        </p>
      </div>

      {onApprove && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApprove(decision.id)}
            disabled={processing}
            className="flex-1"
          >
            确认
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={() => onReject?.(decision.id)}
            disabled={processing}
            className="flex-1"
          >
            驳回
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onDefer?.(decision.id)}
            disabled={processing}
            className="flex-1"
          >
            暂缓
          </Button>
        </div>
      )}
    </div>
  )
}
