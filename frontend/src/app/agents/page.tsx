'use client'

import { useEffect, useState, useCallback } from 'react'
import { AgentCard } from '@/components/agents/agent-card'
import { AgentNetworkDiagram } from '@/components/agents/agent-network-diagram'
import { PageLoading } from '@/components/ui/loading'
import { fetchAgentStatus, triggerAgent } from '@/lib/api'
import type { AgentStatusInfo, AgentName, AgentStatus } from '@/types'

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentStatusInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [triggering, setTriggering] = useState<AgentName | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await fetchAgentStatus()
      setAgents(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => void load(), 10000)
    return () => clearInterval(interval)
  }, [load])

  const handleTrigger = useCallback(async (agentName: AgentName) => {
    setTriggering(agentName)
    try {
      await triggerAgent(agentName, 'daily')
      await load()
      setTimeout(() => {
        void load()
        setTriggering(null)
      }, 5000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '触发失败')
      setTriggering(null)
    }
  }, [load])

  const agentStatuses = Object.fromEntries(
    agents.map(a => [a.agentName, a.status])
  ) as Partial<Record<AgentName, AgentStatus>>

  if (loading && agents.length === 0) return <PageLoading />

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">Agent 运行状态</h1>
          <p className="text-sm text-slate-500 mt-0.5">每10秒自动刷新</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-500">实时监控</span>
        </div>
      </div>

      {/* 多智能体协作示意图 */}
      <AgentNetworkDiagram agentStatuses={agentStatuses} />

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {agents.map((agent, idx) => (
          <div
            key={agent.agentName}
            data-testid={`agent-card-${agent.agentName}`}
            className="animate-fade-in-up"
            style={{ animationDelay: `${idx * 80}ms` }}
          >
            <AgentCard
              agent={agent}
              onTrigger={handleTrigger}
              triggering={triggering === agent.agentName}
            />
          </div>
        ))}
      </div>

      {agents.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <span className="text-4xl mb-3">🤖</span>
          <p className="text-sm">暂无 Agent 数据</p>
        </div>
      )}
    </div>
  )
}
