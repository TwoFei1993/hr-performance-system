'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { DecisionCard } from '@/components/decisions/decision-card'
import { Badge } from '@/components/ui/badge'
import type { Decision, DecisionType } from '@/types'

interface GroupedPendingListProps {
  decisions: Decision[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onDefer: (id: string) => void
  processing: string | null
}

const TYPE_ORDER: DecisionType[] = ['promote', 'salary_raise', 'pip', 'one_on_one']

const TYPE_LABEL: Record<DecisionType, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: '绩效改进（PIP）',
  one_on_one: '1:1 沟通',
}

type BadgeVariant = 'info' | 'success' | 'danger' | 'warning'

const TYPE_VARIANT: Record<DecisionType, BadgeVariant> = {
  promote: 'info',
  salary_raise: 'success',
  pip: 'danger',
  one_on_one: 'warning',
}

const TYPE_ICON: Record<DecisionType, string> = {
  promote: '🚀',
  salary_raise: '💰',
  pip: '⚠️',
  one_on_one: '💬',
}

interface GroupSectionProps {
  type: DecisionType
  items: Decision[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onDefer: (id: string) => void
  processing: string | null
}

function GroupSection({
  type,
  items,
  onApprove,
  onReject,
  onDefer,
  processing,
}: GroupSectionProps) {
  const [open, setOpen] = useState(true)

  if (items.length === 0) return null

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left group"
        aria-expanded={open}
      >
        <span className="text-base">{TYPE_ICON[type]}</span>
        <span className="text-sm font-semibold text-slate-700 group-hover:text-slate-900 transition-colors">
          {TYPE_LABEL[type]}
        </span>
        <Badge variant={TYPE_VARIANT[type]}>{items.length}</Badge>
        <span className="ml-auto text-slate-400">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>

      {open && (
        <div className="grid grid-cols-2 gap-4">
          {items.map((d) => (
            <DecisionCard
              key={d.id}
              decision={d}
              onApprove={onApprove}
              onReject={onReject}
              onDefer={onDefer}
              processing={processing === d.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function GroupedPendingList({
  decisions,
  onApprove,
  onReject,
  onDefer,
  processing,
}: GroupedPendingListProps) {
  const grouped = TYPE_ORDER.reduce<Record<DecisionType, Decision[]>>(
    (acc, t) => {
      acc[t] = decisions.filter((d) => d.type === t)
      return acc
    },
    { promote: [], salary_raise: [], pip: [], one_on_one: [] },
  )

  return (
    <div className="space-y-6">
      {TYPE_ORDER.map((t) => (
        <GroupSection
          key={t}
          type={t}
          items={grouped[t]}
          onApprove={onApprove}
          onReject={onReject}
          onDefer={onDefer}
          processing={processing}
        />
      ))}
    </div>
  )
}
