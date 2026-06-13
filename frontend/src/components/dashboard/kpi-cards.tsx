import { TrendingUp, DollarSign, AlertTriangle, MessageCircle, type LucideIcon } from 'lucide-react'
import type { DashboardStats } from '@/types'

interface KPICardsProps { stats: DashboardStats }

interface KPIItem {
  label: string; value: number; Icon: LucideIcon
  gradient: string; iconBg: string; iconColor: string; valueColor: string
  tag: string; tagColor: string; testId: string
}

function buildItems(stats: DashboardStats): KPIItem[] {
  return [
    {
      label: '待升职', value: stats.pendingPromote, Icon: TrendingUp,
      gradient: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
      iconBg: '#C7D2FE', iconColor: '#4338CA', valueColor: '#3730A3',
      tag: '晋升建议', tagColor: '#6366F1', testId: 'promote',
    },
    {
      label: '待调薪', value: stats.pendingSalaryRaise, Icon: DollarSign,
      gradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)',
      iconBg: '#A7F3D0', iconColor: '#059669', valueColor: '#065F46',
      tag: '薪酬调整', tagColor: '#10B981', testId: 'salary-raise',
    },
    {
      label: '待 PIP', value: stats.pendingPip, Icon: AlertTriangle,
      gradient: 'linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%)',
      iconBg: '#FECACA', iconColor: '#DC2626', valueColor: '#991B1B',
      tag: '绩效改进', tagColor: '#EF4444', testId: 'pip',
    },
    {
      label: '需 1:1', value: stats.pendingOneOnOne, Icon: MessageCircle,
      gradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)',
      iconBg: '#FDE68A', iconColor: '#D97706', valueColor: '#92400E',
      tag: '沟通关注', tagColor: '#F59E0B', testId: 'one-on-one',
    },
  ]
}

export function KPICards({ stats }: KPICardsProps) {
  const items = buildItems(stats)
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {items.map((item, i) => (
        <div
          key={item.label}
          data-testid={`kpi-card-${item.testId}`}
          className={`animate-fade-in-up stagger-${i + 1} rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5`}
          style={{
            background: item.gradient,
            boxShadow: '0 1px 3px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)',
            border: '1px solid rgba(255,255,255,0.8)',
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: item.iconBg }}>
              <item.Icon className="w-[18px] h-[18px]" style={{ color: item.iconColor }} aria-hidden="true" />
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{ color: item.tagColor, background: 'rgba(255,255,255,0.7)' }}
            >
              {item.tag}
            </span>
          </div>
          <p className="text-xs font-medium mb-1" style={{ color: item.valueColor, opacity: 0.7 }}>{item.label}</p>
          <p
            className="text-4xl font-bold tabular-nums leading-none"
            style={{ color: item.valueColor }}
            data-testid={`kpi-value-${item.testId}`}
          >
            {item.value}
          </p>
          <p className="text-xs mt-2" style={{ color: item.valueColor, opacity: 0.5 }}>待处理决策</p>
        </div>
      ))}
    </div>
  )
}
