import { test, expect } from '@playwright/test'
import { DecisionsPage } from '../pages/DecisionsPage'

test.describe('决策审批页面', () => {
  let decisions: DecisionsPage

  test.beforeEach(async ({ page }) => {
    decisions = new DecisionsPage(page)
    await decisions.goto()
  })

  test('页面标题正确', async ({ page }) => {
    await expect(decisions.heading).toBeVisible()
  })

  test('待审批 Tab 默认激活', async ({ page }) => {
    const pendingTab = page.getByRole('button', { name: /待审批/ })
    await expect(pendingTab).toHaveClass(/bg-white/)
  })

  test('待审批列表加载完成', async ({ page }) => {
    // 等待加载状态消失，然后检查是否有卡片或空状态
    await page.waitForFunction(() => {
      const grid = document.querySelector('.grid.grid-cols-2')
      const empty = Array.from(document.querySelectorAll('p')).find(
        (el) => el.textContent?.includes('暂无待审批决策')
      )
      return grid !== null || empty !== null
    }, { timeout: 10000 })
    const hasCards = await page.locator('.grid.grid-cols-2').count()
    const hasEmpty = await page.getByText('暂无待审批决策').count()
    expect(hasCards + hasEmpty).toBeGreaterThan(0)
  })

  test('切换到已处理 Tab 显示历史记录', async ({ page }) => {
    await decisions.switchToHistory()
    const table = page.locator('table')
    const emptyMsg = page.locator('text=暂无处理记录')
    const hasTable = await table.count()
    const hasEmpty = await emptyMsg.count()
    expect(hasTable + hasEmpty).toBeGreaterThan(0)
  })

  test('已处理 Tab 包含员工列表表头', async ({ page }) => {
    await decisions.switchToHistory()
    const table = page.locator('table')
    const count = await table.count()
    if (count > 0) {
      await expect(table.first()).toContainText('员工')
      await expect(table.first()).toContainText('类型')
      await expect(table.first()).toContainText('结果')
    }
  })
})
