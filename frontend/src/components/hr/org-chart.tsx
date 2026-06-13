// 公司组织架构图 — 三层树形结构，fixed tooltip 避免 overflow 裁剪

'use client'

import { useState, useCallback } from 'react'

// ─── 数据定义 ────────────────────────────────────────────────────────────────

interface Group {
  name: string
  employeeCount: number
}

interface Department {
  name: string
  employeeCount: number
  groups: Group[]
}

interface OrgRoot {
  name: string
  title: string
  employeeCount: number
  departments: Department[]
}

interface TooltipState { text: string; x: number; y: number }

// ─── 子组节点 ─────────────────────────────────────────────────────────────────

interface GroupNodeProps {
  group: Group
  isLast: boolean
  onTooltip: (text: string | null, e?: React.MouseEvent) => void
}

function GroupNode({ group, isLast, onTooltip }: GroupNodeProps) {
  return (
    <div className="flex items-start" style={{ height: 60 }}>
      {/* L 形连线 */}
      <div style={{ width: 20, height: isLast ? 30 : '100%', borderLeft: '1px solid #CBD5E1', borderBottom: '1px solid #CBD5E1', flexShrink: 0 }} />
      {/* 节点 */}
      <div
        className="self-start bg-slate-50 border border-slate-200 rounded-xl text-center shadow-sm cursor-default min-w-[130px] px-4 py-2.5"
        style={{ marginTop: 14 }}
        onMouseEnter={(e) => onTooltip(`${group.name}：${group.employeeCount} 人`, e)}
        onMouseLeave={() => onTooltip(null)}
      >
        <span className="text-xs font-medium text-slate-700 leading-tight block">{group.name}</span>
        <span className="text-[11px] text-slate-400 leading-tight block mt-0.5">{group.employeeCount} 人</span>
      </div>
    </div>
  )
}

const ORG_DATA: OrgRoot = {
  name: '总经理',
  title: 'GM',
  employeeCount: 120,
  departments: [
    {
      name: '设备部',
      employeeCount: 18,
      groups: [
        { name: '设备维修组', employeeCount: 9 },
        { name: '设备保养组', employeeCount: 9 },
      ],
    },
    {
      name: '生产部',
      employeeCount: 30,
      groups: [
        { name: '生产一组', employeeCount: 10 },
        { name: '生产二组', employeeCount: 10 },
        { name: '生产三组', employeeCount: 10 },
      ],
    },
    {
      name: '安环部',
      employeeCount: 15,
      groups: [
        { name: '安全组', employeeCount: 8 },
        { name: '环保组', employeeCount: 7 },
      ],
    },
    {
      name: '人行部',
      employeeCount: 12,
      groups: [
        { name: '人事组', employeeCount: 6 },
        { name: '行政组', employeeCount: 6 },
      ],
    },
    {
      name: '质量部',
      employeeCount: 20,
      groups: [
        { name: '检验组', employeeCount: 10 },
        { name: '质量改进组', employeeCount: 10 },
      ],
    },
  ],
}

// ─── 部门列节点（含子组列表） ──────────────────────────────────────────────────

interface DeptColumnProps {
  dept: Department
  onTooltip: (text: string | null, e?: React.MouseEvent) => void
}

function DeptColumn({ dept, onTooltip }: DeptColumnProps) {
  return (
    <div className="flex flex-col items-center" style={{ minWidth: 160 }}>
      <div
        className="bg-white border-2 border-indigo-300 rounded-xl text-center shadow-sm cursor-default min-w-[150px] px-5 py-3"
        onMouseEnter={(e) => onTooltip(`${dept.name}：${dept.employeeCount} 人 | ${dept.groups.length} 个小组`, e)}
        onMouseLeave={() => onTooltip(null)}
      >
        <p className="text-sm font-semibold text-indigo-800 leading-tight">{dept.name}</p>
        <p className="text-[11px] text-indigo-400 mt-0.5">{dept.employeeCount} 人</p>
      </div>
      {dept.groups.length > 0 && (
        <div className="flex flex-col items-start mt-0" style={{ paddingLeft: 12 }}>
          <div className="bg-slate-300 ml-[10px]" style={{ width: 1, height: 14 }} />
          <div className="flex flex-col">
            {dept.groups.map((group, idx) => (
              <GroupNode key={group.name} group={group} isLast={idx === dept.groups.length - 1} onTooltip={onTooltip} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── 主组件 ───────────────────────────────────────────────────────────────────

export function OrgChart() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const handleTooltip = useCallback((text: string | null, e?: React.MouseEvent) => {
    if (!text || !e) { setTooltip(null); return }
    setTooltip({ text, x: e.clientX, y: e.clientY })
  }, [])

  const depts = ORG_DATA.departments

  return (
    <div className="overflow-x-auto pb-4">
      {tooltip && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: tooltip.x + 14, top: tooltip.y - 40 }}>
          <div className="bg-slate-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
            {tooltip.text}
          </div>
          <div className="absolute top-full left-4 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
      <div className="flex flex-col items-center min-w-[1300px] mx-auto px-8 py-6">
        {/* 总经理节点 */}
        <div
          className="bg-indigo-600 text-white rounded-xl text-center shadow-md cursor-default min-w-[220px] px-8 py-4"
          onMouseEnter={(e) => handleTooltip(`全公司 ${ORG_DATA.employeeCount} 人 | ${depts.length} 个部门`, e)}
          onMouseLeave={() => handleTooltip(null)}
        >
          <p className="text-lg font-bold leading-tight">{ORG_DATA.name}</p>
          <p className="text-xs text-indigo-200 mt-0.5">{ORG_DATA.title}</p>
        </div>

        <div className="bg-slate-300" style={{ width: 1, height: 24 }} />

        {/* 水平总线 + 各部门列 */}
        <div className="relative flex items-start gap-10">
          <div className="absolute bg-slate-300 pointer-events-none" style={{ height: 1, top: 0, left: 80, right: 80 }} />
          {depts.map((dept) => (
            <div key={dept.name} className="flex flex-col items-center" style={{ minWidth: 160 }}>
              <div className="bg-slate-300" style={{ width: 1, height: 24 }} />
              <DeptColumn dept={dept} onTooltip={handleTooltip} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
