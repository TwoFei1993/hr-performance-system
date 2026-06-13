'use client'

import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DecisionRationale } from '@/components/decisions/decision-rationale'
import type { Decision, DecisionType, Level } from '@/types'

interface DecisionCardProps {
  decision: Decision & { level?: Level }
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

function confidenceLabel(c: number): string {
  if (c >= 0.85) return '高置信度'
  if (c >= 0.65) return '中置信度'
  return '低置信度'
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
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* 顶部：员工信息行 */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-bold text-slate-900 tracking-tight">
                {decision.employeeName}
              </span>
              <Badge variant="default">{decision.department}</Badge>
              {decision.level && (
                <Badge variant="info">{decision.level}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={TYPE_VARIANT[decision.type]}>
                {TYPE_LABEL[decision.type]}
              </Badge>
              <span className="text-xs text-slate-400">
                {formatDate(decision.createdAt)}
              </span>
            </div>
          </div>
          {/* 置信度 */}
          <div className="shrink-0 text-right">
            <p className="text-2xl font-bold tabular-nums text-slate-800 leading-none">
              {pct}
              <span className="text-sm font-medium text-slate-400">%</span>
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {confidenceLabel(decision.confidence)}
            </p>
            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1.5 ml-auto">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${confidenceColor(decision.confidence)}`}
                style={{ width: mounted ? `${pct}%` : '0%' }}
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 中部：AI 原始理由 + 结构化依据 */}
      <div className="px-5 py-4 space-y-3">
        <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 rounded-lg px-3 py-2.5 border border-slate-100">
          {decision.reason}
        </p>
        <DecisionRationale
          type={decision.type}
          confidence={decision.confidence}
          level={decision.level}
        />
      </div>

      {/* 底部：操作按钮 */}
      {onApprove && (
        <div className="px-5 pb-5 flex items-center gap-2">
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
