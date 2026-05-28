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
import type { EmployeeRecord } from '@/types'

function scoreColor(score: number): string {
  if (score < 60) return 'text-red-600'
  if (score < 80) return 'text-amber-600'
  return 'text-emerald-600'
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

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

      <div className="grid grid-cols-3 gap-5">
        {/* 左侧：基础信息 */}
        <div className="col-span-1 space-y-4">
          <Card>
            <CardHeader><CardTitle>基础信息</CardTitle></CardHeader>
            <CardContent className="py-2">
              <InfoRow label="入职日期" value={employee.hireDate} />
              <InfoRow label="直属上级" value={employee.manager} />
              <InfoRow label="部门" value={employee.department} />
              <InfoRow label="职级" value={employee.level} />
              <div className="flex items-center justify-between py-2.5 border-b border-slate-50">
                <span className="text-xs text-slate-500">综合得分</span>
                <span className={`text-lg font-bold tabular-nums ${scoreColor(employee.compositeScore)}`}>
                  {employee.compositeScore.toFixed(1)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：图表 */}
        <div className="col-span-2 space-y-4">
          <Card>
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

          <Card>
            <CardHeader><CardTitle>近6个月趋势</CardTitle></CardHeader>
            <CardContent>
              <TrendChart scoreHistory={employee.scoreHistory} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI 分析报告 */}
      <Card>
        <CardHeader><CardTitle>AI 分析报告</CardTitle></CardHeader>
        <CardContent>
          <AiReport
            recommendation={employee.recommendation}
            reason={employee.recommendationReason}
            confidence={employee.confidence}
            isAiDegraded={employee.isAiDegraded}
          />
        </CardContent>
      </Card>
    </div>
  )
}
