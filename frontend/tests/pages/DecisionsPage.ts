import { type Page, type Locator } from '@playwright/test'

export class DecisionsPage {
  readonly page: Page
  readonly heading: Locator
  readonly pendingTab: Locator
  readonly historyTab: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: '决策审批' })
    this.pendingTab = page.getByRole('button', { name: /待审批/ })
    this.historyTab = page.getByRole('button', { name: '已处理' })
  }

  async goto() {
    await this.page.goto('/decisions')
    await this.heading.waitFor({ state: 'visible' })
  }

  async getPendingCount() {
    const cards = this.page.locator('.grid.grid-cols-2 > div')
    await this.page.waitForFunction(() => {
      const grid = document.querySelector('.grid.grid-cols-2')
      const empty = Array.from(document.querySelectorAll('p')).find(
        (el) => el.textContent?.includes('暂无待审批决策')
      )
      return grid !== null || empty !== null
    }, { timeout: 10000 })
    return cards.count()
  }

  async approveDecision(index: number) {
    const cards = this.page.locator('.grid.grid-cols-2 > div')
    const card = cards.nth(index)
    const approveBtn = card.getByRole('button', { name: /确认/ })
    await approveBtn.click()
    await this.page.waitForResponse((r) => r.url().includes('/approve') && r.status() === 200)
  }

  async rejectDecision(index: number) {
    const cards = this.page.locator('.grid.grid-cols-2 > div')
    const card = cards.nth(index)
    const rejectBtn = card.getByRole('button', { name: /驳回/ })
    await rejectBtn.click()
    await this.page.waitForResponse((r) => r.url().includes('/reject') && r.status() === 200)
  }

  async switchToHistory() {
    await this.historyTab.click()
    await this.page.waitForResponse((r) => r.url().includes('/api/decisions') && r.status() === 200)
  }
}
