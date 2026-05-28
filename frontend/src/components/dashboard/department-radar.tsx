'use client'

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
  data: Record<string, number>
}

export function DepartmentRadar({ data }: DepartmentRadarProps) {
  const chartData = Object.entries(data).map(([dept, score]) => ({
    dept,
    score: Math.round(score * 10) / 10,
  }))

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>部门均分</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
            <PolarGrid stroke="#e2e8f0" />
            <PolarAngleAxis
              dataKey="dept"
              tick={{ fontSize: 11, fill: '#64748b' }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              tickCount={4}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: 'none',
                borderRadius: '8px',
                color: '#f8fafc',
                fontSize: '12px',
              }}
              formatter={(value) => [value, '均分']}
            />
            <Radar
              dataKey="score"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.15}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
