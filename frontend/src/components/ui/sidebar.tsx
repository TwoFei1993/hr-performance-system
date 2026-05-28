'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: string
}

const navItems: NavItem[] = [
  { label: '主控台', href: '/', icon: '⊞' },
  { label: '员工绩效', href: '/employees', icon: '👥' },
  { label: 'Agent 状态', href: '/agents', icon: '🤖' },
  { label: '决策审批', href: '/decisions', icon: '✅' },
  { label: '月会管理', href: '/monthly-meeting', icon: '📅' },
  { label: 'HR 系统', href: '/hr-system', icon: '🏢' },
]

interface SidebarProps {
  pendingCount?: number
}

export function Sidebar({ pendingCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside
      className="w-60 min-h-screen bg-slate-900 flex flex-col shrink-0"
      aria-label="主导航"
    >
      {/* Logo 区域 */}
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            通
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">通威集团</p>
            <p className="text-slate-400 text-xs leading-tight">绩效管理平台</p>
          </div>
        </div>
      </div>

      {/* 导航项 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isDecisions = item.href === '/decisions'
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800',
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="text-base leading-none" aria-hidden="true">
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {isDecisions && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 底部系统名称 */}
      <div className="px-5 py-4 border-t border-slate-700/60">
        <p className="text-slate-500 text-xs">绩效管理 Agent</p>
        <p className="text-slate-600 text-xs mt-0.5">v1.0.0</p>
      </div>
    </aside>
  )
}
