import type { ExpenseExportFilters } from './types.ts'

export function parseExpenseExportFilters(
  searchParams: URLSearchParams,
): ExpenseExportFilters {
  const allExpenses =
    searchParams.get('all') === '1' || searchParams.get('all') === 'true'

  const expenseType = searchParams.get('expenseType')
  const validTypes = new Set(['project', 'company', 'personal', 'all'])

  return {
    allExpenses,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
    projectId: searchParams.get('projectId') ?? undefined,
    category: searchParams.get('category') ?? undefined,
    subcategory: searchParams.get('subcategory') ?? undefined,
    vendor: searchParams.get('vendor') ?? undefined,
    paymentStatus: searchParams.get('paymentStatus') ?? undefined,
    expenseType:
      expenseType && validTypes.has(expenseType)
        ? (expenseType as ExpenseExportFilters['expenseType'])
        : 'all',
    createdBy: searchParams.get('createdBy') ?? undefined,
  }
}

export function buildFiltersLabel(
  filters: ExpenseExportFilters,
  projectName?: string | null,
): string {
  if (filters.allExpenses) return 'All authorized expenses (no filters)'

  const parts: string[] = []
  if (filters.dateFrom || filters.dateTo) {
    parts.push(
      `Date: ${filters.dateFrom ?? '…'} to ${filters.dateTo ?? '…'}`,
    )
  }
  if (filters.projectId) {
    parts.push(`Project: ${projectName ?? filters.projectId}`)
  }
  if (filters.category) parts.push(`Category: ${filters.category}`)
  if (filters.subcategory) parts.push(`Subcategory: ${filters.subcategory}`)
  if (filters.vendor) parts.push(`Vendor: ${filters.vendor}`)
  if (filters.paymentStatus) parts.push(`Status: ${filters.paymentStatus}`)
  if (filters.expenseType && filters.expenseType !== 'all') {
    parts.push(`Type: ${filters.expenseType}`)
  }
  if (filters.createdBy) parts.push(`Created by: ${filters.createdBy}`)

  return parts.length > 0 ? parts.join(' · ') : 'All authorized expenses'
}

export function buildExportSearchParams(
  filters: ExpenseExportFilters,
  format: 'xlsx' | 'pdf',
): URLSearchParams {
  const params = new URLSearchParams()
  params.set('format', format)
  if (filters.allExpenses) params.set('all', '1')
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  if (filters.projectId) params.set('projectId', filters.projectId)
  if (filters.category) params.set('category', filters.category)
  if (filters.subcategory) params.set('subcategory', filters.subcategory)
  if (filters.vendor) params.set('vendor', filters.vendor)
  if (filters.paymentStatus) params.set('paymentStatus', filters.paymentStatus)
  if (filters.expenseType && filters.expenseType !== 'all') {
    params.set('expenseType', filters.expenseType)
  }
  if (filters.createdBy) params.set('createdBy', filters.createdBy)
  return params
}
