import { type Page, type Locator } from '@playwright/test'

export class MonthlyMeetingPage {
  readonly page: Page
  readonly heading: Locator
  readonly startMeetingBtn: Locator
  readonly finishMeetingBtn: Locator
  readonly agendaList: Locator
  readonly meetingMinutes: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: '月会管理' })
    this.startMeetingBtn = page.getByTestId('start-meeting-btn')
    this.finishMeetingBtn = page.getByTestId('finish-meeting-btn')
    this.agendaList = page.getByTestId('agenda-list')
    this.meetingMinutes = page.getByTestId('meeting-minutes')
  }

  async goto() {
    await this.page.goto('/monthly-meeting')
    await this.heading.waitFor({ state: 'visible' })
  }

  async startMeeting() {
    await this.startMeetingBtn.waitFor({ state: 'visible' })
    await this.startMeetingBtn.click()
    await this.page.waitForResponse((r) => r.url().includes('/monthly-meeting/start') && r.status() === 200)
    await this.agendaList.waitFor({ state: 'visible' })
  }

  async confirmItem(index: number) {
    const items = this.agendaList.locator('[data-testid="agenda-item"], tr, li').nth(index)
    const confirmBtn = items.getByRole('button', { name: /确认/ })
    await confirmBtn.click()
  }

  async finishMeeting() {
    await this.finishMeetingBtn.waitFor({ state: 'visible', timeout: 5000 })
    await this.finishMeetingBtn.click()
    await this.page.waitForResponse((r) => r.url().includes('/monthly-meeting/finish') && r.status() === 200)
    await this.meetingMinutes.waitFor({ state: 'visible' })
  }

  async getMinutes() {
    return this.meetingMinutes.textContent()
  }
}
