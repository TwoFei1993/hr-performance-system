'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageLoading } from '@/components/ui/loading'
import { AgendaList } from '@/components/meeting/agenda-list'
import { MeetingMinutesView } from '@/components/meeting/meeting-minutes'
import {
  startMonthlyMeeting,
  getMonthlyMeetingAgenda,
  confirmMeetingItem,
  finishMonthlyMeeting,
} from '@/lib/api'
import type { MeetingAgenda, MeetingMinutes } from '@/types'

type PageState = 'idle' | 'in_progress' | 'finished'

export default function MonthlyMeetingPage() {
  const [pageState, setPageState] = useState<PageState>('idle')
  const [agenda, setAgenda] = useState<MeetingAgenda | null>(null)
  const [minutes, setMinutes] = useState<MeetingMinutes | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 初始化：尝试获取当前月会状态
  useEffect(() => {
    getMonthlyMeetingAgenda()
      .then((data) => {
        setAgenda(data)
        setPageState(data.status === 'finished' ? 'finished' : 'in_progress')
      })
      .catch(() => {
        // 没有进行中的月会，显示 idle 状态
        setPageState('idle')
      })
      .finally(() => setLoading(false))
  }, [])

  const handleStart = useCallback(async () => {
    setStarting(true)
    setError(null)
    try {
      const data = await startMonthlyMeeting()
      setAgenda(data)
      setPageState('in_progress')
    } catch (err) {
      setError(err instanceof Error ? err.message : '启动失败')
    } finally {
      setStarting(false)
    }
  }, [])

  const handleConfirm = useCallback(async (decisionId: string, confirmed: boolean) => {
    setProcessing(decisionId)
    try {
      await confirmMeetingItem(decisionId, confirmed)
      // 刷新议程
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

  const processedCount = agenda?.items.filter((i) => i.confirmed !== null).length ?? 0
  const confirmedCount = agenda?.items.filter((i) => i.confirmed === true).length ?? 0
  const rejectedCount = agenda?.items.filter((i) => i.confirmed === false).length ?? 0
  const pendingCount = (agenda?.totalItems ?? 0) - processedCount

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">月会管理</h1>
        <p className="text-sm text-slate-500 mt-0.5">月度绩效决策会议</p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* 状态一：无进行中月会 */}
      {pageState === 'idle' && (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-4">
            <span className="text-5xl">📅</span>
            <div className="text-center">
              <h2 className="text-base font-semibold text-slate-900 mb-1">暂无进行中的月会</h2>
              <p className="text-sm text-slate-500 max-w-sm">
                启动月会后，系统将自动汇总当前所有待审批决策，生成月会议程供逐项审议。
              </p>
            </div>
            <Button variant="primary" size="lg" loading={starting} onClick={handleStart}>
              启动月会
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 状态二：月会进行中 */}
      {pageState === 'in_progress' && agenda && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-500">已确认 <strong className="text-emerald-600">{confirmedCount}</strong></span>
              <span className="text-slate-500">已驳回 <strong className="text-red-600">{rejectedCount}</strong></span>
              <span className="text-slate-500">待处理 <strong className="text-slate-700">{pendingCount}</strong></span>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={finishing}
              disabled={processedCount === 0}
              onClick={handleFinish}
            >
              结束月会
            </Button>
          </div>

          <Card>
            <CardHeader><CardTitle>月会议程（共 {agenda.totalItems} 项）</CardTitle></CardHeader>
            <CardContent>
              <AgendaList
                items={agenda.items}
                onConfirm={handleConfirm}
                processing={processing}
              />
            </CardContent>
          </Card>
        </>
      )}

      {/* 状态三：月会已结束 */}
      {pageState === 'finished' && minutes && (
        <Card>
          <CardContent className="py-6">
            <MeetingMinutesView minutes={minutes} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
