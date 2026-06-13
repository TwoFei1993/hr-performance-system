'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Loading } from '@/components/ui/loading'
import type { Decision, DecisionType } from '@/types'

interface NotificationListProps {
  decisions: Decision[]
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  loading?: boolean
}

type BadgeVariant = 'info' | 'success' | 'danger' | 'warning' | 'default'

const typeConfig: Record<DecisionType, { label: string; variant: BadgeVariant }> = {
  promote: { label: '升职', variant: 'info' },
  salary_raise: { label: '调薪', variant: 'success' },
  pip: { label: '绩效改进', variant: 'danger' },
  one_on_one: { label: '1:1 面谈', variant: 'warning' },
}

interface DecisionRowProps {
  decision: Decision
  onApprove: (id: string) => Promise<void>
  onReject: (id: string) => Promise<void>
}

function DecisionRow({ decision, onApprove, onReject }: DecisionRowProps) {
  const [approving, setApproving] = useState(false)
  const [rejecting, setRejecting] = useState(false)
  const config = typeConfig[decision.type]

  async function handleApprove() {
    setApproving(true)
    try {
      await onApprove(decision.id)
    } finally {
      setApproving(false)
    }
  }

  async function handleReject() {
    setRejecting(true)
    try {
      await onReject(decision.id)
    } finally {
      setRejecting(false)
    }
  }

  return (
    <div className="flex items-start gap-4 py-3.5 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors rounded-lg px-2 -mx-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-800 text-sm">{decision.employeeName}</span>
          <span className="text-slate-400 text-xs">{decision.department}</span>
          <Badge variant={config.variant}>{config.label}</Badge>
          <span className="text-slate-400 text-xs ml-auto">
            置信度 {Math.round(decision.confidence * 100)}%
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500 line-clamp-2">{decision.reason}</p>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          variant="primary"
          size="sm"
          loading={approving}
          disabled={rejecting}
          onClick={handleApprove}
          aria-label={`确认 ${decision.employeeName} 的 ${config.label} 决策`}
        >
          确认
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={rejecting}
          disabled={approving}
          onClick={handleReject}
          aria-label={`驳回 ${decision.employeeName} 的 ${config.label} 决策`}
        >
          驳回
        </Button>
      </div>
    </div>
  )
}

export function NotificationList({
  decisions,
  onApprove,
  onReject,
  loading = false,
}: NotificationListProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display">今日 Agent 推送</CardTitle>
          {decisions.length > 0 && (
            <span className="text-xs text-slate-400">{decisions.length} 条待处理</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="py-0">
        {loading ? (
          <div className="py-8">
            <Loading size="md" />
          </div>
        ) : decisions.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center gap-2 text-slate-400">
            <span className="text-3xl">✅</span>
            <p className="text-sm font-medium">暂无待审批决策</p>
            <p className="text-xs text-slate-300">所有决策已处理完毕</p>
          </div>
        ) : (
          <div>
            {decisions.map((d) => (
              <DecisionRow
                key={d.id}
                decision={d}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
