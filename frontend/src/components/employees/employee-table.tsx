'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Loading } from '@/components/ui/loading'
import type { EmployeeRecord, Recommendation, Trend } from '@/types'

interface EmployeeTableProps {
  employees: EmployeeRecord[]
  loading: boolean
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

const TREND_ICON: Record<Trend, string> = {
  up: '↑',
  down: '↓',
  stable: '→',
}

const TREND_COLOR: Record<Trend, string> = {
  up: 'text-emerald-600',
  down: 'text-red-500',
  stable: 'text-slate-400',
}

function scoreColor(score: number): string {
  if (score < 60) return 'text-red-600 font-semibold'
  if (score < 80) return 'text-amber-600 font-semibold'
  return 'text-emerald-600 font-semibold'
}

export function EmployeeTable({ employees, loading }: EmployeeTableProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loading size="lg" label="加载员工数据..." />
      </div>
    )
  }

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-slate-400">
        <span className="text-4xl mb-3">👥</span>
        <p className="text-sm">暂无员工数据</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" role="table" aria-label="员工绩效列表">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">姓名</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">部门</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">职级</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">综合分</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">建议</th>
            <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">趋势</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {employees.map((emp) => (
            <tr
              key={emp.id}
              className="hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3 font-medium text-slate-900">{emp.name}</td>
              <td className="px-4 py-3 text-slate-600">{emp.department}</td>
              <td className="px-4 py-3 text-slate-600">{emp.level}</td>
              <td className={`px-4 py-3 text-right tabular-nums ${scoreColor(emp.compositeScore)}`}>
                {emp.compositeScore.toFixed(1)}
              </td>
              <td className="px-4 py-3">
                <Badge variant={REC_VARIANT[emp.recommendation]}>
                  {REC_LABEL[emp.recommendation]}
                </Badge>
              </td>
              <td className={`px-4 py-3 text-center text-base font-bold ${TREND_COLOR[emp.trend]}`}>
                {TREND_ICON[emp.trend]}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  href={`/employees/${emp.id}`}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline"
                  aria-label={`查看 ${emp.name} 的详情`}
                >
                  查看详情
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
