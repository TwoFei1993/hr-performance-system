'use client'

import type { Department, Recommendation } from '@/types'

interface FilterValues {
  department: string
  recommendation: string
  search: string
}

interface FilterBarProps {
  values: FilterValues
  onChange: (values: FilterValues) => void
}

const DEPARTMENTS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部部门' },
  { value: '研发', label: '研发' },
  { value: '销售', label: '销售' },
  { value: '运营', label: '运营' },
  { value: '财务', label: '财务' },
  { value: '市场', label: '市场' },
  { value: 'HR', label: 'HR' },
]

const RECOMMENDATIONS: Array<{ value: string; label: string }> = [
  { value: '', label: '全部建议' },
  { value: 'promote', label: '升职' },
  { value: 'salary_raise', label: '调薪' },
  { value: 'pip', label: 'PIP' },
  { value: 'one_on_one', label: '1:1' },
  { value: 'normal', label: '正常' },
]

export function FilterBar({ values, onChange }: FilterBarProps) {
  const selectClass =
    'h-9 px-3 pr-8 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 ' +
    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ' +
    'appearance-none cursor-pointer'

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative">
        <select
          value={values.department}
          onChange={(e) => onChange({ ...values, department: e.target.value })}
          className={selectClass}
          aria-label="按部门筛选"
          data-testid="department-filter"
        >
          {DEPARTMENTS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
      </div>

      <div className="relative">
        <select
          value={values.recommendation}
          onChange={(e) => onChange({ ...values, recommendation: e.target.value })}
          className={selectClass}
          aria-label="按建议类型筛选"
        >
          {RECOMMENDATIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">▾</span>
      </div>

      <div className="relative">
        <input
          type="search"
          placeholder="搜索姓名..."
          value={values.search}
          onChange={(e) => onChange({ ...values, search: e.target.value })}
          className="h-9 pl-8 pr-3 text-sm bg-white border border-slate-200 rounded-lg text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48"
          aria-label="按姓名搜索"
          data-testid="search-input"
        />
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">⌕</span>
      </div>
    </div>
  )
}
