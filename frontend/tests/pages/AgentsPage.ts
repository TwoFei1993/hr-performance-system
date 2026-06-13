import { type Page, type Locator } from '@playwright/test'

export class AgentsPage {
  readonly page: Page
  readonly heading: Locator
  readonly triggerBtn: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: 'Agent 运行状态' })
    this.triggerBtn = page.getByTestId('trigger-analysis-btn')
  }

  async goto() {
    await this.page.goto('/agents')
    await this.heading.waitFor({ state: 'visible' })
  }

  async getAgentCard(agentKey: string) {
    return this.page.getByTestId(`agent-card-${agentKey}`)
  }

  async getAgentStatus(agentKey: string) {
    const card = await this.getAgentCard(agentKey)
    const statusText = await card.locator('p.text-xs').first().textContent()
    return statusText?.trim() ?? ''
  }

  async triggerAnalysis() {
    await this.triggerBtn.waitFor({ state: 'visible' })
    await this.triggerBtn.click()
  }

  async getAllAgentCards() {
    return this.page.locator('[data-testid^="agent-card-"]').all()
  }
}
