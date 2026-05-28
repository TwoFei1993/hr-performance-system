'use client'

import { Button } from '@/components/ui/button'
import type { AgentStatusInfo, AgentName, AgentStatus } from '@/types'

interface AgentCardProps {
  agent: AgentStatusInfo
  onTrigger?: (agentName: AgentName) => void
  triggering?: boolean
}

const AGENT_LABEL: Record<AgentName, string> = {
  data_collector: '数据采集 Agent',
  analysis: '分析 Agent',
  decision: '辅助决策 Agent',
  execution: '执行 Agent',
}

const AGENT_DESC: Record<AgentName, string> = {
  data_collector: '自动采集 OKR、360评估、业务指标、出勤数据',
  analysis: '对员工绩效数据进行 AI 分析，生成建议',
  decision: '汇总分析结果，生成待审批决策列表',
  execution: '审批通过后，自动执行 HR 系统操作',
}

const STATUS_DOT: Record<AgentStatus, string> = {
  idle: 'bg-emerald-500',
  running: 'bg-amber-400 animate-pulse',
  error: 'bg-red-500',
}

const STATUS_LABEL: Record<AgentStatus, string> = {
  idle: '空闲',
  running: '运行中',
  error: '异常',
}

function formatTime(iso?: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function AgentCard({ agent, onTrigger, triggering }: AgentCardProps) {
  const canTrigger = agent.agentName === 'analysis'

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[agent.status]}`}
            aria-label={`状态：${STATUS_LABEL[agent.status]}`}
          />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {AGENT_LABEL[agent.agentName]}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {STATUS_LABEL[agent.status]}
            </p>
          </div>
        </div>
        <span className="text-xs text-slate-400 tabular-nums bg-slate-50 px-2 py-1 rounded-md">
          运行 {agent.runCount} 次
        </span>
      </div>

      <p className="text-xs text-slate-500 leading-relaxed">
        {AGENT_DESC[agent.agentName]}
      </p>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-slate-400 mb-0.5">上次运行</p>
          <p className="font-medium text-slate-700">{formatTime(agent.lastRunAt)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg px-3 py-2">
          <p className="text-slate-400 mb-0.5">下次运行</p>
          <p className="font-medium text-slate-700">{formatTime(agent.nextRunAt)}</p>
        </div>
      </div>

      <div className="pt-1">
        {canTrigger ? (
          <Button
            variant="primary"
            size="sm"
            loading={triggering}
            onClick={() => onTrigger?.(agent.agentName)}
            disabled={agent.status === 'running'}
            className="w-full"
          >
            {agent.status === 'running' ? '运行中...' : '手动触发'}
          </Button>
        ) : (
          <div className="text-center text-xs text-slate-400 py-1.5 bg-slate-50 rounded-lg">
            自动触发
          </div>
        )}
      </div>
    </div>
  )
}
