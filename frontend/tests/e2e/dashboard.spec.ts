import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/DashboardPage'

test.describe('主控台页面', () => {
  let dashboard: DashboardPage

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page)
    await dashboard.goto()
  })

  test('页面加载显示正确标题', async () => {
    await expect(dashboard.heading).toBeVisible()
  })

  test('KPI 卡片全部渲染（共4张）', async () => {
    const cards = await dashboard.getKPICards()
    expect(cards.length).toBe(4)
  })

  test('KPI 卡片数字不为空', async ({ page }) => {
    const promoteValue = await page.getByTestId('kpi-value-promote').textContent()
    const pipValue = await page.getByTestId('kpi-value-pip').textContent()
    expect(promoteValue?.trim()).toMatch(/^\d+$/)
    expect(pipValue?.trim()).toMatch(/^\d+$/)
  })

  test('绩效分布图表渲染', async ({ page }) => {
    const chart = page.locator('.recharts-wrapper').first()
    await expect(chart).toBeVisible()
  })

  test('侧边栏导航链接正确', async ({ page }) => {
    await expect(page.getByTestId('nav-dashboard')).toBeVisible()
    await expect(page.getByTestId('nav-employees')).toBeVisible()
    await expect(page.getByTestId('nav-agents')).toBeVisible()
    await expect(page.getByTestId('nav-decisions')).toBeVisible()
    await expect(page.getByTestId('nav-monthly-meeting')).toBeVisible()
    await expect(page.getByTestId('nav-hr-system')).toBeVisible()
  })

  test('主控台导航链接高亮', async ({ page }) => {
    const navLink = page.getByTestId('nav-dashboard')
    await expect(navLink).toHaveAttribute('aria-current', 'page')
  })

  test('启动月会按钮可见', async () => {
    await expect(dashboard.startMeetingBtn).toBeVisible()
  })

  test('待审批决策列表区域渲染', async () => {
    await expect(dashboard.notificationList).toBeVisible()
  })
})
