'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { EmployeeTable } from '@/components/employees/employee-table'
import { FilterBar } from '@/components/employees/filter-bar'
import { fetchEmployees } from '@/lib/api'
import type { EmployeeRecord } from '@/types'

interface FilterValues {
  department: string
  recommendation: string
  search: string
}

const PAGE_SIZE = 20

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<FilterValues>({
    department: '',
    recommendation: '',
    search: '',
  })

  const load = useCallback(async (f: FilterValues, p: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchEmployees({
        page: p,
        size: PAGE_SIZE,
        department: f.department || undefined,
        recommendation: f.recommendation || undefined,
      })
      let items = result.items
      if (f.search.trim()) {
        const q = f.search.trim().toLowerCase()
        items = items.filter((e) => e.name.toLowerCase().includes(q))
      }
      setEmployees(items)
      setTotal(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filters, page)
  }, [filters, page, load])

  const handleFilterChange = useCallback((f: FilterValues) => {
    setFilters(f)
    setPage(1)
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="p-6 space-y-5 max-w-screen-xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 font-display">员工绩效总览</h1>
          <p className="text-sm text-slate-500 mt-0.5">共 {total} 名员工</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          数据加载失败：{error}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>员工列表</CardTitle>
          <FilterBar values={filters} onChange={handleFilterChange} />
        </CardHeader>
        <CardContent className="p-0">
          <EmployeeTable employees={employees} loading={loading} />
        </CardContent>
      </Card>

      {/* 分页控件 */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="上一页"
          >
            ← 上一页
          </button>
          <span className="text-sm text-slate-500 tabular-nums">
            第 {page} / {totalPages} 页
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            aria-label="下一页"
          >
            下一页 →
          </button>
        </div>
      )}
    </div>
  )
}
