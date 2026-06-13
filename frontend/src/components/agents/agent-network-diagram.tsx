'use client'

import { useState, useRef, useEffect } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import type { AgentName, AgentStatus } from '@/types'

gsap.registerPlugin(useGSAP)

interface AgentNetworkDiagramProps {
  agentStatuses?: Partial<Record<AgentName, AgentStatus>>
}

interface SkillStep {
  icon: string
  label: string
  detail: string
}

interface AgentConfig {
  label: string
  shortLabel: string
  color: string
  bgColor: string
  borderColor: string
  textColor: string
  icon: string
  skills: SkillStep[]
}

const AGENT_CONFIG: Record<AgentName, AgentConfig> = {
  data_collector: {
    label: '数据采集 Agent',
    shortLabel: '数据采集',
    color: '#3b82f6',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    icon: '📋',
    skills: [
      { icon: '📋', label: 'OKR 采集', detail: '从绩效系统拉取季度 OKR 完成率' },
      { icon: '👥', label: '360 评估', detail: '汇总同事、上级、下级多维评分' },
      { icon: '📊', label: '业务指标', detail: '对接业务系统获取 KPI 达成数据' },
      { icon: '🕐', label: '出勤履职', detail: '读取考勤系统与履职记录' },
      { icon: '💾', label: '写入数据库', detail: '将采集结果持久化到 SQLite' },
    ],
  },
  analysis: {
    label: '分析 Agent',
    shortLabel: '分析',
    color: '#8b5cf6',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-300',
    textColor: 'text-violet-700',
    icon: '🔬',
    skills: [
      { icon: '🔢', label: '权重计算', detail: 'OKR 30% + 360 25% + 业务 30% + 出勤 15%' },
      { icon: '📈', label: '趋势分析', detail: '对比历史评分，判断上升/下降趋势' },
      { icon: '🤖', label: 'MiniMax 分析', detail: '调用 MiniMax M2.7 生成深度绩效洞察' },
      { icon: '🏷️', label: '建议标注', detail: '输出晋升/调薪/PIP/辅导等建议标签' },
    ],
  },
  decision: {
    label: '辅助决策 Agent',
    shortLabel: '辅助决策',
    color: '#f59e0b',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    icon: '⚖️',
    skills: [
      { icon: '🎯', label: '阈值匹配', detail: '≥88 晋升 / ≥80 调薪 / <45 PIP' },
      { icon: '📝', label: '决策生成', detail: '为每位员工生成结构化决策草案' },
      { icon: '🔍', label: '置信度评估', detail: '计算 AI 建议的置信度分值' },
      { icon: '📬', label: '推送待审批', detail: '通过 SSE 实时推送决策列表' },
    ],
  },
  execution: {
    label: '执行 Agent',
    shortLabel: '执行',
    color: '#10b981',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-300',
    textColor: 'text-emerald-700',
    icon: '⚡',
    skills: [
      { icon: '✅', label: '审批校验', detail: '确认决策已通过 HR 审批' },
      { icon: '🔄', label: 'HR 系统操作', detail: '模拟执行晋升/调薪/PIP 流程' },
      { icon: '📧', label: '通知发送', detail: '生成员工通知与操作记录' },
      { icon: '📁', label: '归档日志', detail: '将执行结果写入 agent_logs 表' },
    ],
  },
}

const STATUS_COLOR: Record<AgentStatus, string> = {
  idle: '#10b981',
  running: '#f59e0b',
  error: '#ef4444',
}

// SVG 画布：640×340，中心 (320, 170)，Agent 节点半径 130
const CX = 320
const CY = 170
const R = 130

const AGENT_ORDER: AgentName[] = ['data_collector', 'analysis', 'decision', 'execution']

// 四个角：左上、右上、右下、左下
const AGENT_ANGLES = [225, 315, 45, 135]

function getPos(angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) }
}

const AGENT_POSITIONS = Object.fromEntries(
  AGENT_ORDER.map((name, i) => [name, getPos(AGENT_ANGLES[i])])
) as Record<AgentName, { x: number; y: number }>

// 流水线顺序：data_collector → analysis → decision → execution
const PIPELINE_EDGES: [AgentName, AgentName][] = [
  ['data_collector', 'analysis'],
  ['analysis', 'decision'],
  ['decision', 'execution'],
]

function AgentNode({
  name,
  config,
  status,
  isSelected,
  isActive,
  onClick,
}: {
  name: AgentName
  config: AgentConfig
  status: AgentStatus
  isSelected: boolean
  isActive: boolean  // 流水线动画高亮
  onClick: () => void
}) {
  const pos = AGENT_POSITIONS[name]
  const statusColor = STATUS_COLOR[status]
  const isRunning = status === 'running'
  const highlight = isSelected || isActive

  return (
    <g
      transform={`translate(${pos.x}, ${pos.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
      role="button"
      aria-label={`${config.label}，点击展开`}
    >
      {/* 选中/激活光晕 */}
      {highlight && (
        <circle r="40" fill={config.color} fillOpacity="0.1">
          {isActive && !isSelected && (
            <animate attributeName="fill-opacity" values="0.05;0.18;0.05" dur="1.2s" repeatCount="indefinite" />
          )}
        </circle>
      )}
      {/* 运行中脉冲环 */}
      {isRunning && (
        <circle r="36" fill="none" stroke={statusColor} strokeWidth="1.5" strokeOpacity="0.4">
          <animate attributeName="r" values="32;42;32" dur="1.6s" repeatCount="indefinite" />
          <animate attributeName="stroke-opacity" values="0.4;0;0.4" dur="1.6s" repeatCount="indefinite" />
        </circle>
      )}
      {/* 主圆背景 */}
      <circle r="32" fill={highlight ? config.color : '#f8fafc'} fillOpacity={highlight ? 0.08 : 1}
        stroke={highlight ? config.color : '#e2e8f0'}
        strokeWidth={highlight ? 2.5 : 1.5}
      />
      {/* 状态点 */}
      <circle cx="21" cy="-21" r="5.5" fill={statusColor} stroke="white" strokeWidth="1.5">
        {isRunning && (
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        )}
      </circle>
      {/* 图标 */}
      <text textAnchor="middle" dominantBaseline="middle" fontSize="20" y="-4">
        {config.icon}
      </text>
      {/* 标签 */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="10"
        y="16"
        fill={highlight ? config.color : '#64748b'}
        fontWeight={highlight ? '700' : '400'}
      >
        {config.shortLabel}
      </text>
    </g>
  )
}

function SkillPanel({ config }: { config: AgentConfig }) {
  const panelRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const panel = panelRef.current
    if (!panel) return

    const steps = panel.querySelectorAll<HTMLElement>('.skill-step')
    const arrows = panel.querySelectorAll<HTMLElement>('.skill-arrow')
    const header = panel.querySelector<HTMLElement>('.skill-header')

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      gsap.set([steps, arrows, header], { opacity: 1, y: 0, scale: 1, scaleX: 1, scaleY: 1 })
      return
    }

    const tl = gsap.timeline()

    // 1. 面板整体从上方弹出
    tl.fromTo(panel,
      { scaleY: 0, transformOrigin: 'top center', opacity: 0 },
      { scaleY: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.8)' }
    )

    // 2. 标题淡入
    if (header) {
      tl.fromTo(header,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.2, ease: 'power2.out' },
        '-=0.1'
      )
    }

    // 3. 步骤节点依次弹入（stagger）
    if (steps.length) {
      tl.fromTo(steps,
        { opacity: 0, y: 16, scale: 0.75 },
        {
          opacity: 1, y: 0, scale: 1,
          duration: 0.28,
          ease: 'back.out(2)',
          stagger: 0.07,
        },
        '-=0.05'
      )
    }

    // 4. 连接箭头依次从左到右生长
    if (arrows.length) {
      tl.fromTo(arrows,
        { scaleX: 0, transformOrigin: 'left center', opacity: 0 },
        {
          scaleX: 1, opacity: 1,
          duration: 0.18,
          ease: 'power2.out',
          stagger: 0.07,
        },
        // 与步骤动画交错，在第一个步骤出现后开始
        '<0.1'
      )
    }
  }, { scope: panelRef })

  return (
    <div
      ref={panelRef}
      className={`rounded-xl border p-4 ${config.bgColor} ${config.borderColor} space-y-4 overflow-hidden`}
    >
      <div className="skill-header flex items-center gap-2">
        <span className="text-base">{config.icon}</span>
        <span className={`text-sm font-semibold ${config.textColor}`}>{config.label}</span>
        <span className="text-xs text-slate-400">— 内部 Skill 流程</span>
      </div>

      <div className="flex flex-wrap items-start">
        {config.skills.map((skill, idx) => (
          <div key={idx} className="flex items-center">
            <div className="skill-step flex flex-col items-center" style={{ minWidth: 76 }}>
              <div
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-xl shadow-sm"
                style={{ border: `2px solid ${config.color}33` }}
              >
                {skill.icon}
              </div>
              <div className="mt-2 text-center px-1">
                <p className={`text-xs font-semibold ${config.textColor} leading-tight`}>
                  {skill.label}
                </p>
                <p className="text-xs text-slate-400 leading-tight mt-0.5">{skill.detail}</p>
              </div>
            </div>

            {idx < config.skills.length - 1 && (
              <div className="skill-arrow flex items-center mb-9 mx-1">
                <div className="h-px" style={{ width: 20, backgroundColor: config.color, opacity: 0.5 }} />
                <svg width="7" height="10" viewBox="0 0 7 10">
                  <path d="M0 0 L7 5 L0 10 Z" fill={config.color} fillOpacity="0.6" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgentNetworkDiagram({ agentStatuses = {} }: AgentNetworkDiagramProps) {
  const [selected, setSelected] = useState<AgentName | null>(null)
  // 流水线动画：每2秒轮流点亮一个 Agent
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIdx(prev => (prev + 1) % AGENT_ORDER.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  const getStatus = (name: AgentName): AgentStatus => agentStatuses[name] ?? 'idle'
  const handleClick = (name: AgentName) => setSelected(prev => prev === name ? null : name)

  // 当前激活的 Agent（流水线动画）
  const activeAgent = AGENT_ORDER[activeIdx]
  // 当前激活的边（从上一个到当前）
  const activeEdgeFrom = activeIdx > 0 ? AGENT_ORDER[activeIdx - 1] : AGENT_ORDER[AGENT_ORDER.length - 1]

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">多智能体协作架构</h2>
        <span className="text-xs text-slate-400">点击 Agent 查看内部 Skill</span>
      </div>

      {/* SVG 协作图 — 全宽，viewBox 留足边距 */}
      <svg
        viewBox="0 0 640 340"
        width="100%"
        style={{ display: 'block' }}
        aria-label="Agent 协作示意图"
      >
        <defs>
          {/* 流动虚线动画用 marker */}
          {AGENT_ORDER.map(name => (
            <marker
              key={`arrow-${name}`}
              id={`arrow-${name}`}
              markerWidth="8" markerHeight="8"
              refX="6" refY="4"
              orient="auto"
            >
              <path d="M0,0 L8,4 L0,8 Z" fill={AGENT_CONFIG[name].color} fillOpacity="0.7" />
            </marker>
          ))}
          <marker id="arrow-gray" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#94a3b8" fillOpacity="0.5" />
          </marker>
        </defs>

        {/* 中心 → 各 Agent 辐射线 */}
        {AGENT_ORDER.map(name => {
          const pos = AGENT_POSITIONS[name]
          const isRunning = getStatus(name) === 'running'
          return (
            <line
              key={`spoke-${name}`}
              x1={CX} y1={CY} x2={pos.x} y2={pos.y}
              stroke={isRunning ? AGENT_CONFIG[name].color : '#e2e8f0'}
              strokeWidth={isRunning ? 2 : 1.5}
              strokeDasharray="5 4"
              opacity={isRunning ? 0.7 : 0.5}
            />
          )
        })}

        {/* 流水线边：data_collector → analysis → decision → execution */}
        {PIPELINE_EDGES.map(([from, to]) => {
          const p1 = AGENT_POSITIONS[from]
          const p2 = AGENT_POSITIONS[to]
          const isActiveEdge = activeEdgeFrom === from && activeAgent === to
          const edgeColor = isActiveEdge ? AGENT_CONFIG[to].color : '#cbd5e1'
          const edgeId = `edge-${from}-${to}`
          return (
            <g key={edgeId}>
              {/* 底层静态线 */}
              <line
                x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                stroke="#e2e8f0" strokeWidth="2"
                markerEnd="url(#arrow-gray)"
              />
              {/* 激活时的流光线 */}
              {isActiveEdge && (
                <line
                  x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke={edgeColor}
                  strokeWidth="2.5"
                  strokeDasharray="12 8"
                  markerEnd={`url(#arrow-${to})`}
                  opacity="0.85"
                >
                  <animate
                    attributeName="stroke-dashoffset"
                    values="20;0"
                    dur="0.6s"
                    repeatCount="indefinite"
                  />
                </line>
              )}
            </g>
          )
        })}

        {/* 中心节点 */}
        <g transform={`translate(${CX}, ${CY})`}>
          <circle r="38" fill="#f0f4ff" stroke="#6366f1" strokeWidth="2" />
          <circle r="32" fill="white" stroke="#e0e7ff" strokeWidth="1.5" />
          <text textAnchor="middle" dominantBaseline="middle" fontSize="22" y="-5">🏢</text>
          <text textAnchor="middle" dominantBaseline="middle" fontSize="9" y="12" fill="#6366f1" fontWeight="700">绩效管理</text>
          <text textAnchor="middle" dominantBaseline="middle" fontSize="9" y="23" fill="#6366f1" fontWeight="700">系统</text>
        </g>

        {/* Agent 节点 */}
        {AGENT_ORDER.map(name => (
          <AgentNode
            key={name}
            name={name}
            config={AGENT_CONFIG[name]}
            status={getStatus(name)}
            isSelected={selected === name}
            isActive={activeAgent === name}
            onClick={() => handleClick(name)}
          />
        ))}
      </svg>

      {/* Skill 展开面板 */}
      {selected && (
        <div className="animate-fade-in-up">
          <SkillPanel config={AGENT_CONFIG[selected]} />
        </div>
      )}

      {/* 图例 */}
      <div className="flex items-center gap-4 pt-1 border-t border-slate-100">
        {[
          { color: '#10b981', label: '空闲' },
          { color: '#f59e0b', label: '运行中' },
          { color: '#ef4444', label: '异常' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-slate-400">{item.label}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-slate-300">点击节点展开 Skill</span>
      </div>
    </div>
  )
}
