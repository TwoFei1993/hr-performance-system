'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { PageLoading } from '@/components/ui/loading'
import { AgendaList } from '@/components/meeting/agenda-list'
import { MeetingMinutesView } from '@/components/meeting/meeting-minutes'
import { MeetingCalendar } from '@/components/meeting/meeting-calendar'
import {
  getMonthlyMeetingAgenda,
  confirmMeetingItem,
  finishMonthlyMeeting,
  fetchMonthlyReports,
  fetchPendingDecisions,
} from '@/lib/api'
import type { MeetingAgenda, MeetingMinutes, Decision, DecisionType } from '@/types'

type PageState = 'idle' | 'in_progress' | 'finished'

const TYPE_LABEL: Record<DecisionType, string> = {
  promote: '晋升',
  salary_raise: '调薪',
  pip: '绩效改进',
  one_on_one: '一对一',
}

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info'

const TYPE_VARIANT: Record<DecisionType, BadgeVariant> = {
  promote: 'success',
  salary_raise: 'info',
  pip: 'danger',
  one_on_one: 'warning',
}

function suggestMeetingSlot(index: number): { label: string; dateKey: string } {
  const d = new Date()
  const day = d.getDay()
  const daysUntilWed = (3 - day + 7) % 7 || 7
  const daysUntilThu = (4 - day + 7) % 7 || 7
  const baseOffset = Math.min(daysUntilWed, daysUntilThu)
  const slotIndex = index % 4
  const dayOffset = Math.floor(index / 4)
  d.setDate(d.getDate() + baseOffset + dayOffset)
  const hours = [9, 11, 14, 16]
  const dateKey = d.toISOString().slice(0, 10)
  return { label: `${d.getMonth() + 1}月${d.getDate()}日 ${hours[slotIndex]}:00`, dateKey }
}

function PendingEmployeeList({ decisions, notified, scheduled, onNotify, onSchedule }: {
  decisions: Decision[]
  notified: Set<string>
  scheduled: Set<string>
  onNotify: (id: string) => void
  onSchedule: (id: string, dateKey: string) => void
}) {
  if (decisions.length === 0) {
    return <p className="text-sm text-slate-500">暂无待关注员工</p>
  }

  // 只对 meetingType 的员工按顺序分配时间槽
  let meetingSlotIndex = 0

  return (
    <div className="space-y-1">
      {decisions.slice(0, 15).map((d) => {
        const isNotifyType = d.type === 'salary_raise' || d.type === 'pip'
        const isMeetingType = d.type === 'promote' || d.type === 'one_on_one'
        const isNotified = notified.has(d.id)
        const isScheduled = scheduled.has(d.id)
        let slot: { label: string; dateKey: string } | null = null
        if (isMeetingType) {
          slot = suggestMeetingSlot(meetingSlotIndex++)
        }

        return (
          <div key={d.id} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0 gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-slate-800">{d.employeeName}</span>
              <span className="text-xs text-slate-400">{d.department}</span>
              <Badge variant={TYPE_VARIANT[d.type]}>{TYPE_LABEL[d.type]}</Badge>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {isMeetingType && slot && !isScheduled && (
                <span className="text-xs text-slate-400">建议：{slot.label}</span>
              )}
              {isNotifyType && (
                <button
                  onClick={() => onNotify(d.id)}
                  disabled={isNotified}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isNotified
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  {isNotified ? '已通知' : '通知主管'}
                </button>
              )}
              {isMeetingType && slot && (
                <button
                  onClick={() => onSchedule(d.id, slot!.dateKey)}
                  disabled={isScheduled}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
                    isScheduled
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'
                  }`}
                >
                  {isScheduled ? '已安排' : '同意会议'}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {decisions.length > 15 && (
        <p className="text-xs text-slate-400 text-center pt-1">还有 {decisions.length - 15} 人...</p>
      )}
    </div>
  )
}

function extractMeetingDates(reports: Awaited<ReturnType<typeof fetchMonthlyReports>>): string[] {
  const dates: string[] = []
  for (const report of reports) {
    const raw = report.content as Record<string, unknown>
    if (typeof raw.meeting_date === 'string') {
      dates.push(raw.meeting_date.slice(0, 10))
    } else {
      dates.push(report.generatedAt.slice(0, 10))
    }
  }
  return [...new Set(dates)]
}

export default function MonthlyMeetingPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null)
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null)
  const [loading, setLoading] = useState(true)
  const [finishing, setFinishing] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [meetingDates, setMeetingDates] = useState<string[]>([])
  const [selectedCalDate, setSelectedCalDate] = useState<string | null>(null)
  const [pendingDecisions, setPendingDecisions] = useState<Decision[]>([])
  // 状态提升：避免切换日期时重置操作状态
  const [notified, setNotified] = useState<Set<string>>(new Set())
  const [scheduled, setScheduled] = useState<Set<string>>(new Set())

  // 初始化：获取当前月会状态 + 历史月报日期 + pending decisions
  useEffect(() => {
    const init = async () => {
      const [agendaResult, reports, decisionsResult] = await Promise.allSettled([
        getMonthlyMeetingAgenda(),
        fetchMonthlyReports(12),
        fetchPendingDecisions(1, 100),
      ])

      if (agendaResult.status === 'fulfilled') {
        const data = agendaResult.value
        setAgenda(data)
        setPageState(data.status === 'finished' ? 'finished' : 'in_progress')
      } else {
        setPageState('idle')
      }

      if (reports.status === 'fulfilled') {
        setMeetingDates(extractMeetingDates(reports.value))
      }

      if (decisionsResult.status === 'fulfilled') {
        setPendingDecisions(decisionsResult.value.items)
      }

      setLoading(false)
    }
    init()
  }, [])

  // 日历选中日期时，显示当日已安排的会议或待关注员工
  const scheduledOnDate = selectedCalDate
    ? pendingDecisions.filter(d => {
        const isMeetingType = d.type === 'promote' || d.type === 'one_on_one'
        return isMeetingType && scheduled.has(d.id)
      })
    : []

  const handleNotify = useCallback((id: string) => {
    setNotified(prev => new Set([...prev, id]))
  }, [])

  const handleScheduleDecision = useCallback((id: string, dateKey: string) => {
    setScheduled(prev => new Set([...prev, id]))
    setMeetingDates(prev => [...new Set([...prev, dateKey])])
  }, [])

  const handleConfirm = useCallback(async (decisionId: string, confirmed: boolean) => {
    try {
      await confirmMeetingItem(decisionId, confirmed)
      const updated = await getMonthlyMeetingAgenda()
      setAgenda(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setProcessing(null)
    }
  }, [])

  const handleFinish = useCallback(async () => {
    setFinishing(true)
    setError(null)
    try {
      const result = await finishMonthlyMeeting()
      setMinutes(result)
      setPageState('finished')
    } catch (err) {
      setError(err instanceof Error ? err.message : '结束月会失败')
    } finally {
      setFinishing(false)
    }
  }, [])

  if (loading) return <PageLoading />

  const today = new Date().toISOString().slice(0, 10)
  const selectedDateHasMeeting = selectedCalDate ? meetingDates.includes(selectedCalDate) : false
  const selectedIsToday = selectedCalDate === today
  const processedCount = agenda?.items.filter((i) => i.confirmed !== null).length ?? 0
  const confirmedCount = agenda?.items.filter((i) => i.confirmed === true).length ?? 0
  const rejectedCount = agenda?.items.filter((i) => i.confirmed === false).length ?? 0
  const pendingCount = (agenda?.totalItems ?? 0) - processedCount

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      {/* 页头 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">月会管理</h1>
          <p className="text-sm text-slate-500 mt-0.5">月度绩效关注会议</p>
        </div>
        {pageState === 'in_progress' && (
          <Button
            variant="primary"
            size="md"
            loading={finishing}
            disabled={processedCount === 0}
            onClick={handleFinish}
            data-testid="finish-meeting-btn"
          >
            结束月会
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 主体：左侧日历 + 右侧内容 */}
      <div className="flex gap-5 items-start">
        {/* 左侧日历 */}
        <div className="w-64 shrink-0">
          <Card>
            <CardHeader><CardTitle>月会日历</CardTitle></CardHeader>
            <CardContent className="pt-3">
              <MeetingCalendar
                meetingDates={meetingDates}
                selectedDate={selectedCalDate}
                onDateClick={(date) => setSelectedCalDate(prev => prev === date ? null : date)}
              />
            </CardContent>
          </Card>
        </div>

        {/* 右侧内容区 */}
        <div className="flex-1 min-w-0 space-y-4 animate-fade-in-up">
          {/* 日历选中日期时 */}
          {pageState === 'idle' && selectedCalDate && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {selectedDateHasMeeting
                    ? `${selectedCalDate} 已安排会议`
                    : `${selectedCalDate} — 当前待关注员工`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedDateHasMeeting ? (
                  scheduledOnDate.length > 0 ? (
                    <div className="space-y-2">
                      {scheduledOnDate.map(d => (
                        <div key={d.id} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-0">
                          <span className="text-sm font-medium text-slate-800">{d.employeeName}</span>
                          <span className="text-xs text-slate-400">{d.department}</span>
                          <Badge variant={TYPE_VARIANT[d.type]}>{TYPE_LABEL[d.type]}</Badge>
                          <span className="text-xs text-emerald-600 ml-auto">已安排</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">暂无会议安排</p>
                  )
                ) : (
                  <>
                    <p className="text-xs text-slate-400 mb-3">该日期暂无记录，以下是当前待关注员工</p>
                    <PendingEmployeeList
                      decisions={pendingDecisions}
                      notified={notified}
                      scheduled={scheduled}
                      onNotify={handleNotify}
                      onSchedule={handleScheduleDecision}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 无进行中月会且未选中日期时，显示当前待关注员工 */}
          {pageState === 'idle' && !selectedCalDate && (
            <Card>
              <CardHeader><CardTitle>当前待关注员工</CardTitle></CardHeader>
              <CardContent>
                <PendingEmployeeList
                  decisions={pendingDecisions}
                  notified={notified}
                  scheduled={scheduled}
                  onNotify={handleNotify}
                  onSchedule={handleScheduleDecision}
                />
              </CardContent>
            </Card>
          )}

          {/* 状态二：月会进行中 */}
          {pageState === 'in_progress' && agenda && (
            <>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-slate-500">已确认 <strong className="text-emerald-600">{confirmedCount}</strong></span>
                <span className="text-slate-500">已驳回 <strong className="text-red-600">{rejectedCount}</strong></span>
                <span className="text-slate-500">待处理 <strong className="text-slate-700">{pendingCount}</strong></span>
              </div>
              <Card>
                <CardHeader><CardTitle>本月绩效关注名单（共 {agenda.totalItems} 项）</CardTitle></CardHeader>
                <CardContent>
                  <div data-testid="agenda-list">
                    <AgendaList items={agenda.items} onConfirm={handleConfirm} processing={processing} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* 状态三：月会已结束 */}
          {pageState === 'finished' && minutes && (
            <Card>
              <CardContent className="py-6">
                <div data-testid="meeting-minutes">
                  <MeetingMinutesView minutes={minutes} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
