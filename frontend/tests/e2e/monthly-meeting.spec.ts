import { test, expect } from '@playwright/test'
import { MonthlyMeetingPage } from '../pages/MonthlyMeetingPage'

test.describe('月会管理页面', () => {
  let meeting: MonthlyMeetingPage

  test.beforeEach(async ({ page }) => {
    meeting = new MonthlyMeetingPage(page)
    await meeting.goto()
  })

  test('页面标题正确', async () => {
    await expect(meeting.heading).toBeVisible()
  })

  test('初始状态显示启动月会按钮或议程列表', async ({ page }) => {
    const startBtn = page.getByTestId('start-meeting-btn')
    const agendaList = page.getByTestId('agenda-list')
    const minutes = page.getByTestId('meeting-minutes')
    const hasStart = await startBtn.count()
    const hasAgenda = await agendaList.count()
    const hasMinutes = await minutes.count()
    expect(hasStart + hasAgenda + hasMinutes).toBeGreaterThan(0)
  })

  test('点击启动月会后显示议程列表', async ({ page }) => {
    const startBtn = page.getByTestId('start-meeting-btn')
    const hasStart = await startBtn.count()
    if (hasStart > 0) {
      await meeting.startMeeting()
      await expect(meeting.agendaList).toBeVisible()
    } else {
      await expect(meeting.agendaList).toBeVisible()
    }
  })

  test('月会进行中时结束月会按钮可见', async ({ page }) => {
    const startBtn = page.getByTestId('start-meeting-btn')
    const hasStart = await startBtn.count()
    if (hasStart > 0) {
      await meeting.startMeeting()
    }
    const agendaList = page.getByTestId('agenda-list')
    const hasAgenda = await agendaList.count()
    if (hasAgenda > 0) {
      await expect(meeting.finishMeetingBtn).toBeVisible()
    }
  })

  test('议程列表有内容时显示总项数', async ({ page }) => {
    const startBtn = page.getByTestId('start-meeting-btn')
    const hasStart = await startBtn.count()
    if (hasStart > 0) {
      await meeting.startMeeting()
    }
    const agendaList = page.getByTestId('agenda-list')
    const hasAgenda = await agendaList.count()
    if (hasAgenda > 0) {
      const totalText = page.locator('text=/月会议程（共 \\d+ 项）/')
      await expect(totalText).toBeVisible()
    }
  })
})
