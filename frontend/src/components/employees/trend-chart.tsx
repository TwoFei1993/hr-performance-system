'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface TrendChartProps {
  scoreHistory: number[]
}

export function TrendChart({ scoreHistory }: TrendChartProps) {
  const months = ['6月前', '5月前', '4月前', '3月前', '2月前', '上月']
  const data = scoreHistory.slice(-6).map((score, i) => ({
    month: months[i] ?? `${6 - i}月前`,
    score,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <ReferenceLine y={60} stroke="#fca5a5" strokeDasharray="4 4" />
        <ReferenceLine y={80} stroke="#86efac" strokeDasharray="4 4" />
        <Tooltip
          formatter={(value) => {
            const num = typeof value === 'number' ? value : Number(value)
            return [`${num.toFixed(1)}`, '综合分']
          }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
        <Line
          type="monotone"
          dataKey="score"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
