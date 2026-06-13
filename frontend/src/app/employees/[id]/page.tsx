'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { ScoreRadar } from '@/components/employees/score-radar'
import { TrendChart } from '@/components/employees/trend-chart'
import { AiReport } from '@/components/employees/ai-report'
import { fetchEmployee } from '@/lib/api'
import type { EmployeeRecord, Recommendation } from '@/types'

// ─── 颜色映射（避免 Tailwind purge 问题）───────────────────────────────────
const METRIC_COLORS: Record<string, string> = {
  indigo: '#6366f1',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
}

const TYPE_LABEL: Record<Recommendation, string> = {
  promote: '升职',
  salary_raise: '调薪',
  pip: 'PIP',
  one_on_one: '1:1',
  normal: '正常',
}

type BadgeVariant = 'info' | 'success' | 'danger' | 'warning' | 'default'

const TYPE_VARIANT: Record<Recommendation, BadgeVariant> = {
  promote: 'info',
  salary_raise: 'success',
  pip: 'danger',
  one_on_one: 'warning',
  normal: 'default',
}

// ─── 工具函数 ────────────────────────────────────────────────────────────────
function scoreColor(score: number): string {
  if (score < 60) return 'text-red-600'
  if (score < 80) return 'text-amber-600'
  return 'text-emerald-600'
}

// ─── 子组件 ──────────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

interface MetricBarProps {
  label: string
  value: number
  weight: string
  color: string
}

function MetricBar({ label, value, weight, color }: MetricBarProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-600">{label}</span>
        <span className="font-semibold text-slate-800">{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{ width: mounted ? `${value}%` : '0%', backgroundColor: METRIC_COLORS[color] ?? '#6366f1' }}
        />
      </div>
      <p className="text-xs text-slate-400 mt-0.5">权重 {weight}</p>
    </div>
  )
}

// ─── 页面主体 ────────────────────────────────────────────────────────────────
export default function EmployeeDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchEmployee(id)
      .then(setEmployee)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) return <PageLoading />

  if (error || !employee) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? '员工不存在'}
        </div>
        <Link href="/employees" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
          ← 返回员工列表
        </Link>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <Link
          href="/employees"
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
          aria-label="返回员工列表"
        >
          ← 返回
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-bold text-slate-900">{employee.name}</h1>
        <Badge variant="default">{employee.department}</Badge>
        <Badge variant="info">{employee.level}</Badge>
      </div>

      {/* 第一行：3列布局 */}
      <div className="grid grid-cols-3 gap-4 items-stretch">
        {/* 左列：基础信息 */}
        <Card className="h-full rounded-xl border border-slate-200">
          <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
          <CardContent className="py-2">
            <InfoRow label="姓名" value={employee.name} />
            <InfoRow label="部门" value={employee.department} />
            <InfoRow label="职级" value={employee.level} />
            <InfoRow label="直属上级" value={employee.manager} />
            <InfoRow label="入职日期" value={employee.hireDate} />
            <div className="mt-3 pt-3 border-t border-slate-100">
              <div className="text-center">
                <span className={`text-3xl font-bold tabular-nums ${scoreColor(employee.compositeScore)}`}>
                  {employee.compositeScore.toFixed(1)}
                </span>
                <p className="text-xs text-slate-500 mt-0.5">综合得分</p>
              </div>
              <div className="mt-2 text-center">
                <Badge variant={TYPE_VARIANT[employee.recommendation]}>
                  {TYPE_LABEL[employee.recommendation]}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 中列：本季度4个指标 */}
        <Card className="h-full rounded-xl border border-slate-200">
          <CardHeader><CardTitle>本季度指标</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <MetricBar label="OKR完成率" value={employee.okrScore} weight="30%" color="indigo" />
            <MetricBar label="360评估" value={employee.reviewScore360} weight="25%" color="violet" />
            <MetricBar label="业务指标" value={employee.businessScore} weight="30%" color="emerald" />
            <MetricBar label="出勤履职" value={employee.attendanceScore} weight="15%" color="amber" />
          </CardContent>
        </Card>

        {/* 右列：四维度雷达图 */}
        <Card className="h-full rounded-xl border border-slate-200">
          <CardHeader><CardTitle>四维度得分</CardTitle></CardHeader>
          <CardContent>
            <ScoreRadar
              okrScore={employee.okrScore}
              reviewScore360={employee.reviewScore360}
              businessScore={employee.businessScore}
              attendanceScore={employee.attendanceScore}
            />
          </CardContent>
        </Card>
      </div>

      {/* 第二行：近6个月趋势（整行） */}
      <Card className="rounded-xl border border-slate-200">
        <CardHeader><CardTitle>近6个月绩效趋势</CardTitle></CardHeader>
        <CardContent>
          <TrendChart scoreHistory={employee.scoreHistory} />
        </CardContent>
      </Card>

      {/* 第三行：AI 分析报告（整行） */}
      <Card className="rounded-xl border border-slate-200">
        <CardHeader><CardTitle>AI 分析报告</CardTitle></CardHeader>
        <CardContent>
          <AiReport employee={employee} isAiDegraded={employee.isAiDegraded} />
        </CardContent>
      </Card>
    </div>
  )
}
