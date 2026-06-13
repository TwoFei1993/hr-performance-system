import type { DecisionType, Level } from '@/types'

interface DecisionRationaleProps {
  type: DecisionType
  confidence: number
  level?: Level
}

interface RationaleItem {
  icon: string
  text: string
}

interface RationaleConfig {
  title: string
  items: RationaleItem[]
}

function getNextLevel(level?: Level): string {
  const map: Partial<Record<Level, string>> = {
    P4: 'P5',
    P5: 'P6',
    P6: 'P7',
    P7: 'P8',
    P8: 'P9',
  }
  return level ? (map[level] ?? '高级职级') : '高级职级'
}

function buildRationale(
  type: DecisionType,
  confidence: number,
  level?: Level,
): RationaleConfig {
  switch (type) {
    case 'salary_raise':
      return {
        title: '调薪建议依据',
        items: [
          {
            icon: '📊',
            text: `综合绩效评分：${confidence > 0.8 ? '优秀' : '良好'}，连续表现稳定`,
          },
          {
            icon: '💹',
            text: `当前职级 ${level ?? '—'} 薪资处于市场中位数以下`,
          },
          { icon: '🎯', text: '近3个月 OKR 完成率持续超过 80%' },
          { icon: '📈', text: '建议调薪幅度：10–15%' },
        ],
      }
    case 'promote':
      return {
        title: '晋升建议依据',
        items: [
          { icon: '🏆', text: '综合绩效评分超过晋升门槛（85分）' },
          {
            icon: '📅',
            text: `已在当前职级 ${level ?? '—'} 工作超过 18 个月`,
          },
          { icon: '👥', text: '360评估中领导力维度评分优秀' },
          {
            icon: '🚀',
            text: `建议晋升至：${getNextLevel(level)}`,
          },
        ],
      }
    case 'pip':
      return {
        title: '绩效改进计划依据',
        items: [
          { icon: '📉', text: '综合绩效评分低于及格线（60分）' },
          { icon: '❌', text: '连续2个季度未完成 OKR 目标' },
          { icon: '🕐', text: '出勤履职评分偏低' },
          { icon: '📋', text: '建议：制定90天改进计划，每月1:1跟进' },
        ],
      }
    case 'one_on_one':
      return {
        title: '1:1 沟通建议依据',
        items: [
          { icon: '📉', text: '绩效趋势持续下滑（近3个月）' },
          { icon: '🔍', text: '可能存在工作障碍或个人问题' },
          { icon: '💬', text: '建议：安排直属上级进行深度沟通' },
          { icon: '🔄', text: '频率：每周一次，持续1个月' },
        ],
      }
  }
}

const TYPE_BG: Record<DecisionType, string> = {
  salary_raise: 'bg-emerald-50 border-emerald-100',
  promote: 'bg-indigo-50 border-indigo-100',
  pip: 'bg-red-50 border-red-100',
  one_on_one: 'bg-amber-50 border-amber-100',
}

const TYPE_TITLE_COLOR: Record<DecisionType, string> = {
  salary_raise: 'text-emerald-700',
  promote: 'text-indigo-700',
  pip: 'text-red-700',
  one_on_one: 'text-amber-700',
}

export function DecisionRationale({
  type,
  confidence,
  level,
}: DecisionRationaleProps) {
  const config = buildRationale(type, confidence, level)

  return (
    <div
      className={`rounded-lg border px-4 py-3 space-y-2 ${TYPE_BG[type]}`}
    >
      <p className={`text-xs font-semibold ${TYPE_TITLE_COLOR[type]}`}>
        {config.title}
      </p>
      <ul className="space-y-1.5">
        {config.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
            <span className="shrink-0 leading-4">{item.icon}</span>
            <span className="leading-4">{item.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
