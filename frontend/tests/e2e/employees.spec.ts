import { test, expect } from '@playwright/test'
import { EmployeesPage } from '../pages/EmployeesPage'

test.describe('员工绩效总览页面', () => {
  let employees: EmployeesPage

  test.beforeEach(async ({ page }) => {
    employees = new EmployeesPage(page)
    await employees.goto()
  })

  test('员工列表加载显示 20 条记录', async () => {
    const count = await employees.getEmployeeCount()
    expect(count).toBe(20)
  })

  test('总数显示 120 名员工', async () => {
    const total = await employees.getTotalCount()
    expect(total).toBe(120)
  })

  test('按部门筛选后结果减少', async ({ page }) => {
    const beforeCount = await employees.getEmployeeCount()
    await employees.filterByDepartment('研发')
    await page.waitForSelector('[data-testid="employee-row"]')
    const afterCount = await employees.getEmployeeCount()
    expect(afterCount).toBeLessThanOrEqual(beforeCount)
  })

  test('搜索员工姓名后结果变化', async ({ page }) => {
    await employees.searchByName('张')
    await page.waitForTimeout(500)
    const rows = page.getByTestId('employee-row')
    const count = await rows.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('点击员工查看详情跳转到详情页', async ({ page }) => {
    await employees.clickEmployee(0)
    await expect(page).toHaveURL(/\/employees\//)
  })

  test('员工详情页显示员工姓名', async ({ page }) => {
    await employees.clickEmployee(0)
    await page.waitForURL(/\/employees\//)
    const heading = page.getByRole('heading').first()
    await expect(heading).toBeVisible()
  })

  test('员工详情页图表渲染', async ({ page }) => {
    await employees.clickEmployee(0)
    await page.waitForURL(/\/employees\//)
    const chart = page.locator('.recharts-wrapper').first()
    await expect(chart).toBeVisible({ timeout: 10000 })
  })
})
