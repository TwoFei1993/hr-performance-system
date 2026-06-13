import { test, expect } from '@playwright/test'
import { AgentsPage } from '../pages/AgentsPage'

const AGENT_KEYS = ['data_collector', 'analysis', 'decision', 'execution']
const AGENT_LABELS = ['数据采集 Agent', '分析 Agent', '辅助决策 Agent', '执行 Agent']

test.describe('Agent 状态页面', () => {
  let agents: AgentsPage

  test.beforeEach(async ({ page }) => {
    agents = new AgentsPage(page)
    await agents.goto()
  })

  test('四个 Agent 卡片全部显示', async () => {
    const cards = await agents.getAllAgentCards()
    expect(cards.length).toBe(4)
  })

  test('数据采集 Agent 卡片可见', async ({ page }) => {
    const card = await agents.getAgentCard('data_collector')
    await expect(card).toBeVisible()
    await expect(card).toContainText('数据采集 Agent')
  })

  test('分析 Agent 卡片可见', async ({ page }) => {
    const card = await agents.getAgentCard('analysis')
    await expect(card).toBeVisible()
    await expect(card).toContainText('分析 Agent')
  })

  test('辅助决策 Agent 卡片可见', async ({ page }) => {
    const card = await agents.getAgentCard('decision')
    await expect(card).toBeVisible()
    await expect(card).toContainText('辅助决策 Agent')
  })

  test('执行 Agent 卡片可见', async ({ page }) => {
    const card = await agents.getAgentCard('execution')
    await expect(card).toBeVisible()
    await expect(card).toContainText('执行 Agent')
  })

  test('手动触发按钮仅在分析 Agent 卡片中显示', async ({ page }) => {
    const triggerBtns = page.getByTestId('trigger-analysis-btn')
    const count = await triggerBtns.count()
    expect(count).toBe(1)
  })

  test('点击触发分析按钮发送 API 请求', async ({ page }) => {
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/agents/trigger')),
      agents.triggerAnalysis(),
    ])
    expect(request.method()).toBe('POST')
  })
})
