import { type Page, type Locator } from '@playwright/test'

export class DashboardPage {
  readonly page: Page
  readonly heading: Locator
  readonly kpiCards: Locator
  readonly notificationList: Locator
  readonly startMeetingBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: '绩效管理中心' })
    this.kpiCards = page.locator('[data-testid^="kpi-card-"]')
    this.notificationList = page.getByTestId('notification-list')
    this.startMeetingBtn = page.getByTestId('start-meeting-btn')
  }

  async goto() {
    await this.page.goto('/')
    await this.heading.waitFor({ state: 'visible' })
  }

  async getKPICards() {
    return this.kpiCards.all()
  }

  async getKPIValue(type: 'promote' | 'salary-raise' | 'pip' | 'one-on-one') {
    const text = await this.page.getByTestId(`kpi-value-${type}`).textContent()
    return text ? parseInt(text.trim(), 10) : 0
  }

  async getPendingDecisionCount() {
    const badge = this.page.locator('[data-testid="notification-list"]').locator('text=待审批')
    const count = await badge.count()
    return count
  }

  async approveFirstDecision() {
    const approveBtn = this.notificationList.getByRole('button', { name: /确认|通过/ }).first()
    await approveBtn.click()
  }

  async rejectFirstDecision() {
    const rejectBtn = this.notificationList.getByRole('button', { name: /驳回/ }).first()
    await rejectBtn.click()
  }
}
