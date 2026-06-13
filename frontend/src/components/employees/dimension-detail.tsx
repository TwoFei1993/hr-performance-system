'use client'

import { useState } from 'react'
import type { EmployeeRecord } from '@/types'

type DimensionKey = 'okr' | '360' | 'business' | 'attendance'

interface DimensionTab {
  key: DimensionKey
  label: string
}

const TABS: DimensionTab[] = [
  { key: 'okr', label: 'OKR完成率' },
  { key: '360', label: '360评估' },
  { key: 'business', label: '业务指标' },
  { key: 'attendance', label: '出勤履职' },
]

interface MetricRowProps {
  label: string
  value: string
  highlight?: boolean
}

function MetricRow({ label, value, highlight = false }: MetricRowProps) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${highlight ? 'text-blue-600' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  )
}

function StatusBadge({ score }: { score: number }) {
  const label = score >= 80 ? '优秀' : score >= 60 ? '达标' : '待改进'
  const cls =
    score >= 80
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : score >= 60
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-red-50 text-red-700 border-red-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      {label}
    </span>
  )
}

interface DimensionDetailProps {
  employee: EmployeeRecord
}

export function DimensionDetail({ employee }: DimensionDetailProps) {
  const [active, setActive] = useState<DimensionKey>('okr')
  const { okrScore, reviewScore360, businessScore, attendanceScore } = employee

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Tab 导航 */}
      <div className="flex border-b border-slate-100">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer
              ${active === tab.key
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            aria-selected={active === tab.key}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 内容区 */}
      <div className="px-4 py-3 space-y-0.5" role="tabpanel">
        {active === 'okr' && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500">本季度 OKR 完成率</span>
              <span className="text-sm font-bold text-blue-600 tabular-nums">{okrScore}%</span>
            </div>
            <MetricRow label="权重" value="30%（占综合分）" />
            <MetricRow label="贡献分" value={`${(okrScore * 0.3).toFixed(1)} 分`} highlight />
            <div className="flex items-center justify-between py-2">
              <span className="text-xs text-slate-500">状态</span>
              <StatusBadge score={okrScore} />
            </div>
          </>
        )}

        {active === '360' && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500">360度评估得分</span>
              <span className="text-sm font-bold text-blue-600 tabular-nums">{reviewScore360} 分</span>
            </div>
            <MetricRow label="权重" value="25%（占综合分）" />
            <MetricRow label="贡献分" value={`${(reviewScore360 * 0.25).toFixed(1)} 分`} highlight />
            <MetricRow label="评估维度" value="团队协作 / 沟通能力 / 专业技能 / 领导力" />
          </>
        )}

        {active === 'business' && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500">业务指标完成度</span>
              <span className="text-sm font-bold text-blue-600 tabular-nums">{businessScore}%</span>
            </div>
            <MetricRow label="权重" value="30%（占综合分）" />
            <MetricRow label="贡献分" value={`${(businessScore * 0.3).toFixed(1)} 分`} highlight />
            <MetricRow label="核心指标" value="项目交付率 / 质量达标率 / 客户满意度" />
          </>
        )}

        {active === 'attendance' && (
          <>
            <div className="flex items-center justify-between py-2 border-b border-slate-50">
              <span className="text-xs text-slate-500">出勤履职评分</span>
              <span className="text-sm font-bold text-blue-600 tabular-nums">{attendanceScore} 分</span>
            </div>
            <MetricRow label="权重" value="15%（占综合分）" />
            <MetricRow label="贡献分" value={`${(attendanceScore * 0.15).toFixed(1)} 分`} highlight />
            <MetricRow label="考核项" value="出勤率 / 会议参与 / 任务响应速度" />
          </>
        )}
      </div>
    </div>
  )
}
