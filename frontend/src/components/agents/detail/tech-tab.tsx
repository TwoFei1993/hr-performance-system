import type { AgentName } from '@/types'

interface TechTabProps {
  agentName: AgentName
}

interface TechItem {
  label: string
  value: string
}

interface TechContent {
  items: TechItem[]
  notes?: string[]
}

const TECH_DATA: Record<AgentName, TechContent> = {
  data_collector: {
    items: [
      { label: '语言', value: 'Python 3.13' },
      { label: '数据库', value: 'SQLite (aiosqlite)' },
      { label: '调度', value: 'APScheduler' },
      { label: '数据分布', value: '正态分布（numpy）' },
      { label: '员工规模', value: '120 名员工' },
      { label: '更新频率', value: '每小时随机更新 20 名员工' },
    ],
  },
  analysis: {
    items: [
      { label: '语言', value: 'Python 3.13' },
      { label: 'AI 模型', value: 'MiniMax M2.7' },
      { label: 'API 端点', value: 'https://api.minimaxi.chat/v1' },
      { label: '超时设置', value: '30 秒' },
      { label: '重试策略', value: '失败重试 2 次' },
      { label: '降级方案', value: '规则引擎（基于阈值）' },
      { label: '数据库', value: 'SQLite (aiosqlite)' },
      { label: '调度', value: 'APScheduler（每日 08:00）' },
    ],
    notes: [
      'AI 调用失败时自动降级到规则引擎，保证服务可用性',
      '规则引擎基于综合得分阈值生成静态建议',
    ],
  },
  decision: {
    items: [
      { label: '语言', value: 'Python 3.13' },
      { label: '数据库', value: 'SQLite (aiosqlite)' },
      { label: '触发方式', value: '分析 Agent 完成后事件驱动' },
      { label: '推送协议', value: 'Server-Sent Events (SSE)' },
      { label: '事件类型', value: 'decision_created' },
      { label: '去重策略', value: '同员工同类型 pending 决策唯一' },
    ],
    notes: [
      '通过 SSE 实时推送新决策到前端，无需轮询',
      '去重逻辑防止同一员工产生重复待审批项',
    ],
  },
  execution: {
    items: [
      { label: '语言', value: 'Python 3.13' },
      { label: '数据库', value: 'SQLite (aiosqlite)' },
      { label: '触发方式', value: '审批通过后事件驱动' },
      { label: '推送协议', value: 'Server-Sent Events (SSE)' },
      { label: '事件类型', value: 'decision_updated' },
      { label: '职级范围', value: 'P4 → P5 → P6 → P7 → P8 → P9' },
    ],
    notes: [
      '执行结果写入 execution_result 字段，供审计追踪',
      '执行完成后通过 SSE 广播状态变更',
    ],
  },
}

export function AgentTechTab({ agentName }: TechTabProps) {
  const data = TECH_DATA[agentName]

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <tbody>
            {data.items.map((item, idx) => (
              <tr
                key={item.label}
                className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}
              >
                <td className="px-5 py-3 text-xs text-slate-400 font-medium w-32 shrink-0">
                  {item.label}
                </td>
                <td className="px-5 py-3 text-slate-700 font-mono text-xs">
                  {item.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.notes && data.notes.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2">
          {data.notes.map((note) => (
            <p key={note} className="text-xs text-indigo-700 flex items-start gap-2">
              <span className="w-1 h-1 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
