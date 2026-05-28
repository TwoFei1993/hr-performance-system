'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

interface PerformanceChartProps {
  data: Array<{ range: string; count: number }>
}

// 根据分数段索引返回颜色：低分红，高分绿
function getBarColor(index: number, total: number): string {
  const ratio = index / (total - 1)
  if (ratio < 0.3) return '#ef4444'   // red-500
  if (ratio < 0.5) return '#f97316'   // orange-500
  if (ratio < 0.7) return '#eab308'   // yellow-500
  if (ratio < 0.85) return '#22c55e'  // green-500
  return '#16a34a'                     // green-600
}

export function PerformanceChart({ data }: PerformanceChartProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>绩效分布</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="range"
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
              }}
              cursor={{ fill: '#f1f5f9' }}
              formatter={(value) => [value, '人数']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={getBarColor(index, data.length)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
