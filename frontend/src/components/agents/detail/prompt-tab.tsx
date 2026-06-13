import type { AgentName } from '@/types'

interface PromptTabProps {
  agentName: AgentName
}

interface PromptContent {
  systemPrompt?: string
  userPromptTemplate?: string
  note?: string
}

const PROMPT_DATA: Record<AgentName, PromptContent> = {
  data_collector: {
    note: '数据采集 Agent 使用纯规则逻辑，不调用 AI 模型，无 Prompt 配置。',
  },
  analysis: {
    systemPrompt: `你是通威集团的绩效分析专家。请根据员工的绩效数据，给出专业的分析和建议。

分析时请考虑以下维度：
- OKR完成率（权重30%）：目标达成情况
- 360度评估（权重25%）：同事和上级评价
- 业务指标（权重30%）：实际业务产出
- 出勤履职（权重15%）：出勤和工作态度

请以JSON格式返回分析结果，包含：
- recommendation: 建议类型（promote/salary_raise/pip/one_on_one/normal）
- reason: 建议原因（50字以内）
- confidence: 置信度（0.0-1.0）`,
    userPromptTemplate: `请分析以下员工的绩效数据：

员工姓名：{name}
部门：{department}
职级：{level}

绩效数据：
- OKR完成率：{okr_score}分
- 360度评估：{review_score_360}分
- 业务指标：{business_score}分
- 出勤履职：{attendance_score}分
- 综合得分：{composite_score}分
- 得分趋势：{trend}

历史得分（最近6期）：{score_history}

请给出绩效分析和建议。`,
  },
  decision: {
    note: '辅助决策 Agent 使用规则引擎，不调用 AI 模型，无 Prompt 配置。决策规则基于综合得分阈值和趋势判断。',
  },
  execution: {
    note: '执行 Agent 直接操作数据库，不调用 AI 模型，无 Prompt 配置。',
  },
}

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </p>
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs leading-relaxed overflow-x-auto whitespace-pre-wrap font-mono">
        {code}
      </pre>
    </div>
  )
}

export function AgentPromptTab({ agentName }: PromptTabProps) {
  const data = PROMPT_DATA[agentName]

  if (data.note) {
    return (
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
        <p className="text-sm text-slate-500">{data.note}</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {agentName === 'analysis' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs text-amber-700">
            <span className="font-semibold">AI 模型：</span>MiniMax M2.7 &nbsp;|&nbsp;
            <span className="font-semibold">API：</span>https://api.minimaxi.chat/v1
          </p>
        </div>
      )}

      {data.systemPrompt && (
        <CodeBlock label="System Prompt" code={data.systemPrompt} />
      )}

      {data.userPromptTemplate && (
        <CodeBlock label="User Prompt 模板" code={data.userPromptTemplate} />
      )}
    </div>
  )
}
