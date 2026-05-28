import { Badge } from '@/components/ui/badge'
import type { Recommendation } from '@/types'

interface AiReportProps {
  recommendation: Recommendation
  reason: string
  confidence: number
  isAiDegraded?: boolean
}

const REC_LABEL: Record<Recommendation, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: 'PIP',
  one_on_one: '1:1',
  normal: '正常',
}

type BadgeVariant = 'info' | 'success' | 'danger' | 'warning' | 'default'

const REC_VARIANT: Record<Recommendation, BadgeVariant> = {
  promote: 'info',
  salary_raise: 'success',
  pip: 'danger',
  one_on_one: 'warning',
  normal: 'default',
}

function confidenceColor(c: number): string {
  if (c >= 0.8) return 'bg-emerald-500'
  if (c >= 0.6) return 'bg-amber-400'
  return 'bg-red-400'
}

export function AiReport({ recommendation, reason, confidence, isAiDegraded }: AiReportProps) {
  const pct = Math.round(confidence * 100)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-medium text-slate-600">AI 建议：</span>
        <Badge variant={REC_VARIANT[recommendation]}>
          {REC_LABEL[recommendation]}
        </Badge>
        {isAiDegraded && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
            <span>⚠</span> 规则引擎（AI降级）
          </span>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">建议理由</p>
        <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 rounded-lg px-4 py-3 border border-slate-100">
          {reason}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-medium text-slate-500">置信度</p>
          <span className="text-xs font-semibold text-slate-700 tabular-nums">{pct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${confidenceColor(confidence)}`}
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`置信度 ${pct}%`}
          />
        </div>
      </div>
    </div>
  )
}
