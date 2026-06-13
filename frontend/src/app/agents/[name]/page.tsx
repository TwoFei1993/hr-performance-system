'use client'

export const runtime = 'edge'

import { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import type { AgentName } from '@/types'
import { AgentOverviewTab } from '@/components/agents/detail/overview-tab'
import { AgentPromptTab } from '@/components/agents/detail/prompt-tab'
import { AgentTechTab } from '@/components/agents/detail/tech-tab'

type TabId = 'overview' | 'prompt' | 'tech'

const AGENT_LABEL: Record<AgentName, string> = {
  data_collector: '数据采集 Agent',
  analysis: '分析 Agent',
  decision: '辅助决策 Agent',
  execution: '执行 Agent',
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: '概述' },
  { id: 'prompt', label: 'Prompt' },
  { id: 'tech', label: '技术实现' },
]

const VALID_AGENT_NAMES: AgentName[] = [
  'data_collector',
  'analysis',
  'decision',
  'execution',
]

function isValidAgentName(name: string): name is AgentName {
  return VALID_AGENT_NAMES.includes(name as AgentName)
}

export default function AgentDetailPage() {
  const params = useParams()
  const rawName = typeof params.name === 'string' ? params.name : ''
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  if (!isValidAgentName(rawName)) {
    return (
      <div className="p-6">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          返回 Agent 列表
        </Link>
        <p className="text-slate-500">未找到该 Agent：{rawName}</p>
      </div>
    )
  }

  const agentName: AgentName = rawName

  return (
    <div className="p-6 max-w-screen-xl space-y-6">
      {/* 顶部导航 */}
      <div className="flex items-center gap-3">
        <Link
          href="/agents"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-lg font-bold text-slate-900">
          {AGENT_LABEL[agentName]}
        </h1>
      </div>

      {/* Tab 切换 */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-1" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors',
                activeTab === tab.id
                  ? 'text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50/50'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 内容 */}
      <div role="tabpanel">
        {activeTab === 'overview' && <AgentOverviewTab agentName={agentName} />}
        {activeTab === 'prompt' && <AgentPromptTab agentName={agentName} />}
        {activeTab === 'tech' && <AgentTechTab agentName={agentName} />}
      </div>
    </div>
  )
}
