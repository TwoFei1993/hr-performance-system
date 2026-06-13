import type { AgentName } from '@/types'

interface OverviewTabProps {
  agentName: AgentName
}

interface AgentOverview {
  name: string
  responsibility: string
  trigger: string
  dataSources?: Array<{ label: string; source: string }>
  coreLogic?: string[]
  decisionRules?: string[]
  dedupeLogic?: string[]
  ssePush?: string[]
  executeActions?: string[]
}

const OVERVIEW_DATA: Record<AgentName, AgentOverview> = {
  data_collector: {
    name: '数据采集 Agent',
    responsibility: '自动采集员工绩效数据，模拟数据波动',
    trigger: '每小时自动运行 + 手动触发',
    dataSources: [
      { label: 'OKR 完成率', source: 'OKR 系统' },
      { label: '360度评估', source: 'HR 系统' },
      { label: '业务指标', source: 'ERP 系统' },
      { label: '出勤履职', source: '考勤系统' },
    ],
    coreLogic: [
      '生成 120 名员工的绩效数据',
      '使用正态分布模拟真实数据波动',
      '每小时随机选 20 名员工更新分数',
    ],
  },
  analysis: {
    name: '分析 Agent',
    responsibility: '对员工绩效数据进行 AI 分析，生成建议',
    trigger: '每日 08:00 自动运行 + 手动触发',
    coreLogic: [
      'OKR完成率 × 30%',
      '360评估 × 25%',
      '业务指标 × 30%',
      '出勤履职 × 15%',
    ],
    decisionRules: [
      'AI 超时（30s）→ 重试 2 次 → 规则引擎降级',
      '规则引擎：基于阈值的静态规则',
    ],
  },
  decision: {
    name: '辅助决策 Agent',
    responsibility: '汇总分析结果，生成待审批决策列表',
    trigger: '分析 Agent 完成后自动触发',
    decisionRules: [
      'composite_score ≥ 88 → 升职建议',
      'composite_score ≥ 80 → 调薪建议',
      'composite_score < 45 → PIP 建议',
      '45–55 且 trend=down → 1:1 沟通建议',
    ],
    dedupeLogic: [
      '同一员工同类型决策不重复创建',
      '已有 pending 决策时跳过',
    ],
    ssePush: ['新决策创建时广播 decision_created 事件'],
  },
  execution: {
    name: '执行 Agent',
    responsibility: '审批通过后，自动执行 HR 系统操作',
    trigger: '决策审批通过后自动触发',
    executeActions: [
      'promote：更新员工职级（P4→P5→…→P9）',
      'salary_raise：记录调薪 +10%',
      'pip：标记绩效改进计划',
      'one_on_one：创建日历邀请',
    ],
    ssePush: ['执行完成后广播 decision_updated 事件'],
  },
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-400 w-20 shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-slate-700">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
        {title}
      </h3>
      {children}
    </div>
  )
}

export function AgentOverviewTab({ agentName }: OverviewTabProps) {
  const data = OVERVIEW_DATA[agentName]

  return (
    <div className="grid grid-cols-1 gap-4">
      <Section title="基本信息">
        <InfoRow label="名称" value={data.name} />
        <InfoRow label="职责" value={data.responsibility} />
        <InfoRow label="触发方式" value={data.trigger} />
      </Section>

      {data.dataSources && (
        <Section title="数据源">
          <ul className="space-y-2">
            {data.dataSources.map((ds) => (
              <li key={ds.label} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{ds.label}</span>
                <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded">
                  来自 {ds.source}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.coreLogic && (
        <Section title={agentName === 'analysis' ? '分析维度' : '核心逻辑'}>
          <ul className="space-y-1.5">
            {data.coreLogic.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.decisionRules && (
        <Section title={agentName === 'analysis' ? '降级策略' : '决策规则'}>
          <ul className="space-y-1.5">
            {data.decisionRules.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.dedupeLogic && (
        <Section title="去重逻辑">
          <ul className="space-y-1.5">
            {data.dedupeLogic.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.executeActions && (
        <Section title="执行操作">
          <ul className="space-y-1.5">
            {data.executeActions.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.ssePush && (
        <Section title="SSE 推送">
          <ul className="space-y-1.5">
            {data.ssePush.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 mt-1.5 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  )
}
