'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export interface MeetingCalendarProps {
  meetingDates: string[]
  onDateClick?: (date: string) => void
  selectedDate?: string | null
}

const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function isSameDay(a: string, b: string): boolean {
  return a === b
}

export function MeetingCalendar({
  meetingDates,
  onDateClick,
  selectedDate,
}: MeetingCalendarProps) {
  const today = useMemo(() => toDateKey(new Date()), [])
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth())

  const meetingSet = useMemo(() => new Set(meetingDates), [meetingDates])

  // 生成当月日历格子（包含前后补位）
  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const lastDay = new Date(viewYear, viewMonth + 1, 0)
    const startOffset = firstDay.getDay() // 0=Sun
    const totalDays = lastDay.getDate()

    const result: Array<{ key: string; day: number; currentMonth: boolean }> = []

    // 前补位（上月末尾）
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth, -i)
      result.push({ key: toDateKey(d), day: d.getDate(), currentMonth: false })
    }

    // 当月
    for (let d = 1; d <= totalDays; d++) {
      const date = new Date(viewYear, viewMonth, d)
      result.push({ key: toDateKey(date), day: d, currentMonth: true })
    }

    // 后补位（凑满 6 行 × 7 列 = 42）
    const remaining = 42 - result.length
    for (let d = 1; d <= remaining; d++) {
      const date = new Date(viewYear, viewMonth + 1, d)
      result.push({ key: toDateKey(date), day: d, currentMonth: false })
    }

    return result
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthLabel = `${viewYear} 年 ${viewMonth + 1} 月`

  return (
    <div className="select-none">
      {/* 月份导航 */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="上个月"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-slate-700">{monthLabel}</span>
        <button
          onClick={nextMonth}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
          aria-label="下个月"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* 周标题 */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_LABELS.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-slate-400 py-1">
            {label}
          </div>
        ))}
      </div>

      {/* 日期格子 */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((cell) => {
          const isToday = isSameDay(cell.key, today)
          const hasMeeting = meetingSet.has(cell.key)
          const isSelected = selectedDate ? isSameDay(cell.key, selectedDate) : false
          // 所有当月日期都可以点击
          const isClickable = cell.currentMonth

          return (
            <div
              key={cell.key}
              onClick={() => isClickable && onDateClick?.(cell.key)}
              className={[
                'relative flex flex-col items-center justify-center h-8 rounded-lg text-xs transition-colors',
                cell.currentMonth ? 'text-slate-700' : 'text-slate-300',
                isToday && !isSelected ? 'ring-1 ring-indigo-400 text-indigo-600 font-semibold' : '',
                isSelected ? 'bg-indigo-600 text-white font-bold ring-2 ring-indigo-400' : '',
                isClickable && !isSelected ? 'cursor-pointer hover:bg-indigo-50 hover:text-indigo-700' : '',
                !isClickable ? 'cursor-default' : '',
              ].filter(Boolean).join(' ')}
              aria-label={cell.currentMonth ? `${cell.key}${hasMeeting ? '，有月会' : ''}` : undefined}
            >
              <span>{cell.day}</span>
              {hasMeeting && cell.currentMonth && !isToday && !isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-orange-400" />
              )}
              {hasMeeting && cell.currentMonth && (isToday || isSelected) && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white/70" />
              )}
            </div>
          )
        })}
      </div>

      {/* 图例 */}
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="w-4 h-4 rounded-md bg-indigo-600 inline-block" />
          今天
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="relative w-4 h-4 rounded-md bg-white border border-slate-200 inline-flex items-end justify-center pb-0.5">
            <span className="w-1 h-1 rounded-full bg-orange-400 inline-block" />
          </span>
          有月会
        </div>
      </div>
    </div>
  )
}
