'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, Bot, CheckSquare,
  Calendar, Building2, Zap, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem { label: string; href: string; Icon: LucideIcon }

const navItems: NavItem[] = [
  { label: '主控台',     href: '/',               Icon: LayoutDashboard },
  { label: '员工绩效',   href: '/employees',       Icon: Users },
  { label: 'Agent 状态', href: '/agents',          Icon: Bot },
  { label: '决策审批',   href: '/decisions',       Icon: CheckSquare },
  { label: '月会管理',   href: '/monthly-meeting', Icon: Calendar },
  { label: 'HR 系统',    href: '/hr-system',       Icon: Building2 },
]

const NAV_TESTID: Record<string, string> = {
  '/': 'nav-dashboard',
  '/employees': 'nav-employees',
  '/agents': 'nav-agents',
  '/decisions': 'nav-decisions',
  '/monthly-meeting': 'nav-monthly-meeting',
  '/hr-system': 'nav-hr-system',
}

interface SidebarProps { pendingCount?: number }

export function Sidebar({ pendingCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  return (
    <aside className="w-56 min-h-screen flex flex-col shrink-0" style={{ background: '#0B1120' }} aria-label="主导航">
      {/* Logo */}
      <div className="px-4 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
          >
            <Zap className="w-4 h-4 text-white" aria-hidden="true" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight tracking-wide">通威集团</p>
            <p className="text-xs leading-tight" style={{ color: '#64748B' }}>绩效管理平台</p>
          </div>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isDecisions = item.href === '/decisions'
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={NAV_TESTID[item.href]}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 group',
                isActive ? 'text-white font-medium' : 'hover:text-white',
              )}
              style={isActive
                ? { background: 'linear-gradient(90deg, rgba(79,70,229,0.9) 0%, rgba(79,70,229,0.7) 100%)', boxShadow: '0 2px 8px rgba(79,70,229,0.3)' }
                : { color: '#94A3B8' }
              }
              aria-current={isActive ? 'page' : undefined}
            >
              <item.Icon
                className={cn('w-4 h-4 shrink-0 transition-colors', isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')}
                aria-hidden="true"
              />
              <span className="flex-1">{item.label}</span>
              {isDecisions && pendingCount > 0 && (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold"
                  style={{ background: '#EF4444' }}
                >
                  {pendingCount > 99 ? '99+' : pendingCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* 底部 */}
      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <p className="text-xs" style={{ color: '#475569' }}>系统运行中 · v1.0.0</p>
        </div>
      </div>
    </aside>
  )
}
