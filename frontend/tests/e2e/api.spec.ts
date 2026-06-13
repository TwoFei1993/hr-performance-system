import { test, expect } from '@playwright/test'

const API_BASE = 'http://localhost:8002'

test.describe('后端 API 测试', () => {
  test('GET /api/health 返回 200 和 ok 状态', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.status).toBe('ok')
  })

  test('GET /api/dashboard/stats 返回正确数据结构', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/dashboard/stats`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    // API 返回 snake_case 字段
    expect(typeof body.pending_promote).toBe('number')
    expect(typeof body.pending_salary_raise).toBe('number')
    expect(typeof body.pending_pip).toBe('number')
    expect(typeof body.pending_one_on_one).toBe('number')
    expect(typeof body.total_employees).toBe('number')
  })

  test('GET /api/employees 返回 120 条记录', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/employees?page=1&size=20`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.total).toBe(120)
    expect(Array.isArray(body.items)).toBe(true)
    expect(body.items.length).toBe(20)
  })

  test('GET /api/agents/status 返回 4 个 Agent', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/agents/status`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(4)
  })

  test('POST /api/agents/trigger 返回 202', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/agents/trigger`, {
      data: { agent: 'analysis', scope: 'daily' },
    })
    expect(response.status()).toBe(202)
  })

  test('GET /api/decisions/pending 返回列表结构', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/decisions/pending?page=1&size=10`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(Array.isArray(body.items)).toBe(true)
    expect(typeof body.total).toBe('number')
  })

  test('GET /api/employees/{id} 返回员工详情', async ({ request }) => {
    const listResp = await request.get(`${API_BASE}/api/employees?page=1&size=1`)
    const list = await listResp.json()
    const firstId = list.items[0]?.id
    if (firstId) {
      const detailResp = await request.get(`${API_BASE}/api/employees/${firstId}`)
      expect(detailResp.status()).toBe(200)
      const detail = await detailResp.json()
      expect(detail.id).toBe(firstId)
    }
  })
})
