import { type Page, type Locator } from '@playwright/test'

export class EmployeesPage {
  readonly page: Page
  readonly heading: Locator
  readonly employeeRows: Locator
  readonly searchInput: Locator
  readonly departmentFilter: Locator
  readonly employeeTable: Locator

  constructor(page: Page) {
    this.page = page
    this.heading = page.getByRole('heading', { name: '员工绩效总览' })
    this.employeeRows = page.getByTestId('employee-row')
    this.searchInput = page.getByTestId('search-input')
    this.departmentFilter = page.getByTestId('department-filter')
    this.employeeTable = page.getByTestId('employee-table')
  }

  async goto() {
    await this.page.goto('/employees')
    await this.heading.waitFor({ state: 'visible' })
    await this.employeeTable.waitFor({ state: 'visible' })
  }

  async getEmployeeCount() {
    await this.employeeRows.first().waitFor({ state: 'visible' })
    return this.employeeRows.count()
  }

  async getTotalCount() {
    const text = await this.page.locator('text=/共 \\d+ 名员工/').textContent()
    const match = text?.match(/共 (\d+) 名员工/)
    return match ? parseInt(match[1], 10) : 0
  }

  async filterByDepartment(dept: string) {
    await this.departmentFilter.selectOption(dept)
    await this.page.waitForResponse((r) => r.url().includes('/api/employees') && r.status() === 200)
  }

  async searchByName(name: string) {
    await this.searchInput.fill(name)
    await this.page.waitForTimeout(300)
  }

  async clickEmployee(index: number) {
    const rows = await this.employeeRows.all()
    // 链接的 aria-label 是 "查看 {name} 的详情"，用 text 选择器更可靠
    const link = rows[index].locator('a')
    await link.click()
  }
}
