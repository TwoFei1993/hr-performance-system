'use client'

import { useState } from 'react'
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface DepartmentRadarProps {
  data: Record<string, Record<string, number>>
}

const DIM_LABELS: Record<string, string> = {
  job_fit: '岗位适配',
  innovation: '创新性',
  execution: '执行力',
  teamwork: '团队协作',
  growth: '学习成长',
  contribution: '业务贡献',
}

const DIMS = ['job_fit', 'innovation', 'execution', 'teamwork', 'growth', 'contribution']

const DEPT_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']

export function DepartmentRadar({ data }: DepartmentRadarProps) {
  const [selectedDept, setSelectedDept] = useState<string | null>(null)

  if (!data || Object.keys(data).length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle>部门6维度评分</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
            暂无数据
          </div>
        </CardContent>
      </Card>
    )
  }

  // 所有部门（含"全公司"）
  const allDepts = Object.keys(data)
  // 非"全公司"部门，用于多部门叠加显示
  const depts = allDepts.filter((d) => d !== '全公司')

  // 筛选按钮：全部 + 全公司（若存在）+ 各部门
  const filterButtons = ['全部', ...allDepts]

  // 将 {研发: {job_fit: 75, ...}, ...} 转换为 Recharts 格式
  const chartData = DIMS.map((dim) => ({
    dim: DIM_LABELS[dim],
    ...Object.fromEntries(
      allDepts.map((dept) => [dept, Math.round((data[dept]?.[dim] ?? 0) * 10) / 10])
    ),
  }))

  // 当前激活的部门列表
  const activeDepts: string[] =
    selectedDept === null
      ? depts                          // 全部：显示所有非"全公司"部门
      : selectedDept === '全公司'
        ? ['全公司']
        : [selectedDept]

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>部门6维度评分</CardTitle>
      </CardHeader>
      <CardContent>
        {/* 筛选按钮组 */}
        <div className="flex flex-wrap gap-1 mb-3">
          {filterButtons.map((btn) => {
            const isActive =
              btn === '全部' ? selectedDept === null : selectedDept === btn
            return (
              <button
                key={btn}
                type="button"
                onClick={() => setSelectedDept(btn === '全部' ? null : btn)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {btn}
              </button>
            )
          })}
        </div>

        <ResponsiveContainer width="100%" height={220}>
          <RadarChart data={chartData} margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="dim"
              tick={({ x, y, payload }: { x: string | number; y: string | number; payload: { value: string } }) => (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  fill="#64748b"
                >
                  {payload.value}
                </text>
              )}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
              tickCount={5}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#0f172a',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            />
            {/* 全部模式：显示所有非"全公司"部门（半透明叠加） */}
            {selectedDept === null &&
              depts.map((dept, i) => (
                <Radar
                  key={dept}
                  dataKey={dept}
                  stroke={DEPT_COLORS[i % DEPT_COLORS.length]}
                  fill={DEPT_COLORS[i % DEPT_COLORS.length]}
                  fillOpacity={0.1}
                  strokeWidth={1.5}
                />
              ))}
            {/* 全公司模式 */}
            {selectedDept === '全公司' && (
              <Radar
                dataKey="全公司"
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            )}
            {/* 单部门高亮模式 */}
            {selectedDept !== null && selectedDept !== '全公司' && (
              <Radar
                dataKey={selectedDept}
                stroke="#4f46e5"
                fill="#4f46e5"
                fillOpacity={0.3}
                strokeWidth={2}
              />
            )}
          </RadarChart>
        </ResponsiveContainer>

        {/* 全部模式下的图例 */}
        {selectedDept === null && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {depts.map((dept, i) => (
              <div key={dept} className="flex items-center gap-1 text-xs text-slate-600">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
                />
                {dept}
              </div>
            ))}
          </div>
        )}

        {/* 选中部门时显示各维度得分 */}
        {activeDepts.length === 1 && (
          <div className="grid grid-cols-3 gap-1 mt-2">
            {DIMS.map((dim) => {
              const score = data[activeDepts[0]]?.[dim] ?? 0
              return (
                <div key={dim} className="flex items-center justify-between px-2 py-1 bg-slate-50 rounded text-xs">
                  <span className="text-slate-500">{DIM_LABELS[dim]}</span>
                  <span className="font-semibold text-slate-800">{Math.round(score * 10) / 10}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
