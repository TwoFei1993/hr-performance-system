import { test, expect } from '@playwright/test'

const PAGES = [
  { path: '/', title: '绩效管理中心', navTestId: 'nav-dashboard' },
  { path: '/employees', title: '员工绩效总览', navTestId: 'nav-employees' },
  { path: '/agents', title: 'Agent 运行状态', navTestId: 'nav-agents' },
  { path: '/decisions', title: '决策审批', navTestId: 'nav-decisions' },
  { path: '/monthly-meeting', title: '月会管理', navTestId: 'nav-monthly-meeting' },
  { path: '/hr-system', title: 'HR 系统', navTestId: 'nav-hr-system' },
]

test.describe('导航功能', () => {
  test('从主控台导航到员工绩效页面', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-employees').click()
    await expect(page).toHaveURL('/employees')
    await expect(page.getByRole('heading', { name: '员工绩效总览' })).toBeVisible()
  })

  test('从员工绩效导航到 Agent 状态页面', async ({ page }) => {
    await page.goto('/employees')
    await page.getByTestId('nav-agents').click()
    await expect(page).toHaveURL('/agents')
    await expect(page.getByRole('heading', { name: 'Agent 运行状态' })).toBeVisible()
  })

  test('从 Agent 状态导航到决策审批页面', async ({ page }) => {
    await page.goto('/agents')
    await page.getByTestId('nav-decisions').click()
    await expect(page).toHaveURL('/decisions')
    await expect(page.getByRole('heading', { name: '决策审批' })).toBeVisible()
  })

  test('主控台侧边栏链接高亮', async ({ page }) => {
    await page.goto('/')
    const navLink = page.getByTestId('nav-dashboard')
    await expect(navLink).toHaveAttribute('aria-current', 'page')
  })

  test('员工绩效页面侧边栏链接高亮', async ({ page }) => {
    await page.goto('/employees')
    const navLink = page.getByTestId('nav-employees')
    await expect(navLink).toHaveAttribute('aria-current', 'page')
  })

  test('所有页面标题正确', async ({ page }) => {
    for (const { path, title } of PAGES) {
      await page.goto(path)
      const heading = page.getByRole('heading', { name: title })
      await expect(heading).toBeVisible({ timeout: 15000 })
    }
  })

  test('浏览器后退按钮正常工作', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('nav-employees').click()
    await expect(page).toHaveURL('/employees')
    await page.goBack()
    await expect(page).toHaveURL('/')
  })
})
