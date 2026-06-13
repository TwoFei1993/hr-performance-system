'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { TrendingUp, DollarSign, AlertTriangle, Users } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { OperationLog } from '@/components/hr/operation-log'
import { OrgChart } from '@/components/hr/org-chart'
import { fetchDecisionHistory } from '@/lib/api'
import type { Decision } from '@/types'

// ── 统计卡片 ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  gradientFrom: string
  gradientTo: string
  textColor: string
}

function StatCard({ label, value, icon, gradientFrom, gradientTo, textColor }: StatCardProps) {
  return (
    <div
      className="rounded-xl shadow-sm px-5 py-4 flex items-center gap-4"
      style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/20">
        <span className="text-white">{icon}</span>
      </div>
      <div>
        <p className="text-xs text-white/70 mb-0.5">{label}</p>
        <p className={`text-2xl font-bold tabular-nums ${textColor}`}>{value}</p>
      </div>
    </div>
  )
}

// ── 操作类型分布图 ─────────────────────────────────────────────────────────────

interface ChartEntry {
  name: string
  count: number
  color: string
}

interface TypeChartProps {
  data: ChartEntry[]
}

function TypeDistributionChart({ data }: TypeChartProps) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#475569' }}
          width={36}
        />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          formatter={(v) => [v ?? 0, '数量']}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={24}>
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 主页面 ────────────────────────────────────────────────────────────────────

export default function HrSystemPage() {
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchDecisionHistory({ page: 1, size: 100 })
      setDecisions(result.items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // 本月执行数
  const now = new Date()
  const thisMonthCount = decisions.filter((d) => {
    if (!d.resolvedAt) return false
    const date = new Date(d.resolvedAt)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length

  const promoteCount = decisions.filter((d) => d.type === 'promote').length
  const salaryCount = decisions.filter((d) => d.type === 'salary_raise').length
  const pipCount = decisions.filter((d) => d.type === 'pip').length
  const oneOnOneCount = decisions.filter((d) => d.type === 'one_on_one').length

  const chartData: ChartEntry[] = [
    { name: '升职', count: promoteCount, color: '#6366f1' },
    { name: '调薪', count: salaryCount, color: '#10b981' },
    { name: 'PIP', count: pipCount, color: '#ef4444' },
    { name: '1:1', count: oneOnOneCount, color: '#f59e0b' },
  ]

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">HR 系统</h1>
          <p className="text-sm text-slate-500 mt-0.5">操作执行记录 · 共 {total} 条已确认决策</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          系统正常运行
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          数据加载失败：{error}
        </div>
      )}

      {/* 4 个统计卡片 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="本月执行操作"
          value={thisMonthCount}
          icon={<Users size={18} />}
          gradientFrom="#3b82f6"
          gradientTo="#6366f1"
          textColor="text-white"
        />
        <StatCard
          label="升职人数"
          value={promoteCount}
          icon={<TrendingUp size={18} />}
          gradientFrom="#6366f1"
          gradientTo="#8b5cf6"
          textColor="text-white"
        />
        <StatCard
          label="调薪人数"
          value={salaryCount}
          icon={<DollarSign size={18} />}
          gradientFrom="#10b981"
          gradientTo="#059669"
          textColor="text-white"
        />
        <StatCard
          label="PIP 人数"
          value={pipCount}
          icon={<AlertTriangle size={18} />}
          gradientFrom="#f59e0b"
          gradientTo="#ef4444"
          textColor="text-white"
        />
      </div>

      {!loading && decisions.length === 0 && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
          暂无已执行的决策记录。请先触发 Agent 分析并审批决策，或点击主页的「复位」按钮重置演示数据。
        </div>
      )}

      {/* 操作类型分布图 */}
      <Card>
        <CardHeader>
          <CardTitle>操作类型分布</CardTitle>
        </CardHeader>
        <CardContent>
          <TypeDistributionChart data={chartData} />
        </CardContent>
      </Card>

      {/* 执行记录表格 */}
      <Card>
        <CardHeader>
          <CardTitle>执行记录（已确认决策）</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <OperationLog decisions={decisions} loading={loading} />
        </CardContent>
      </Card>

      {/* 公司组织架构 */}
      <Card>
        <CardHeader>
          <CardTitle>公司组织架构</CardTitle>
        </CardHeader>
        <CardContent className="overflow-visible">
          <OrgChart />
        </CardContent>
      </Card>
    </div>
  )
}
