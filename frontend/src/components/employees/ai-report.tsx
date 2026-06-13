import { Badge } from '@/components/ui/badge'
import type { EmployeeRecord, Recommendation } from '@/types'

interface AiReportProps {
  employee: EmployeeRecord
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

export function AiReport({ employee, isAiDegraded }: AiReportProps) {
  const { recommendation, recommendationReason, confidence } = employee
  const { okrScore, reviewScore360, businessScore, attendanceScore, compositeScore } = employee
  const pct = Math.round(confidence * 100)

  const okrContrib = (okrScore * 0.3).toFixed(1)
  const reviewContrib = (reviewScore360 * 0.25).toFixed(1)
  const bizContrib = (businessScore * 0.3).toFixed(1)
  const attContrib = (attendanceScore * 0.15).toFixed(1)

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
          {recommendationReason}
        </p>
      </div>

      {/* 得分计算公式 */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-1.5">综合得分计算公式</p>
        <div className="bg-slate-50 rounded-lg px-4 py-3 border border-slate-100 space-y-1.5 overflow-x-auto">
          <p className="text-xs text-slate-500 font-mono whitespace-nowrap">
            OKR完成率 × 30% + 360评估 × 25% + 业务指标 × 30% + 出勤履职 × 15%
          </p>
          <p className="text-xs text-slate-600 font-mono whitespace-nowrap">
            = {okrScore} × 0.30 + {reviewScore360} × 0.25 + {businessScore} × 0.30 + {attendanceScore} × 0.15
          </p>
          <p className="text-xs text-slate-600 font-mono whitespace-nowrap">
            = {okrContrib} + {reviewContrib} + {bizContrib} + {attContrib}
          </p>
          <p className="text-sm font-bold text-blue-700 font-mono border-t border-slate-200 pt-1.5">
            = {compositeScore.toFixed(1)} 分
          </p>
        </div>
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
