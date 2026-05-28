import { Card, CardContent } from '@/components/ui/card'
import type { DashboardStats } from '@/types'

interface KPICardsProps {
  stats: DashboardStats
}

interface KPIItem {
  label: string
  value: number
  icon: string
  colorClass: string
  bgClass: string
  borderClass: string
}

function buildItems(stats: DashboardStats): KPIItem[] {
  return [
    {
      label: '待升职',
      value: stats.pendingPromote,
      icon: '↑',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
      borderClass: 'border-blue-200',
    },
    {
      label: '待调薪',
      value: stats.pendingSalaryRaise,
      icon: '¥',
      colorClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
      borderClass: 'border-emerald-200',
    },
    {
      label: '待淘汰',
      value: stats.pendingPip,
      icon: '⚠',
      colorClass: 'text-red-600',
      bgClass: 'bg-red-50',
      borderClass: 'border-red-200',
    },
    {
      label: '需 1:1',
      value: stats.pendingOneOnOne,
      icon: '◎',
      colorClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
      borderClass: 'border-amber-200',
    },
  ]
}

export function KPICards({ stats }: KPICardsProps) {
  const items = buildItems(stats)

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className={`border ${item.borderClass}`}>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                  {item.label}
                </p>
                <p className={`mt-1.5 text-3xl font-bold ${item.colorClass}`}>
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-slate-400">待处理决策</p>
              </div>
              <div
                className={`w-10 h-10 rounded-lg ${item.bgClass} flex items-center justify-center`}
                aria-hidden="true"
              >
                <span className={`text-lg font-bold ${item.colorClass}`}>
                  {item.icon}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
