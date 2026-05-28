'use client'

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

interface ScoreRadarProps {
  okrScore: number
  reviewScore360: number
  businessScore: number
  attendanceScore: number
}

export function ScoreRadar({
  okrScore,
  reviewScore360,
  businessScore,
  attendanceScore,
}: ScoreRadarProps) {
  const data = [
    { subject: 'OKR', value: okrScore },
    { subject: '360评估', value: reviewScore360 },
    { subject: '业务指标', value: businessScore },
    { subject: '出勤履职', value: attendanceScore },
  ]

  return (
    <ResponsiveContainer width="100%" height={220}>
      <RadarChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 12, fill: '#64748b' }}
        />
        <Radar
          name="得分"
          dataKey="value"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip
          formatter={(value) => {
            const num = typeof value === 'number' ? value : Number(value)
            return [`${num.toFixed(1)}`, '得分']
          }}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}
