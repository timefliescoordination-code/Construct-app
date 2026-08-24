import { NextRequest, NextResponse } from 'next/server'
import {
  getCompanyNameForExport,
  requireExpenseExportAuth,
} from '@/lib/expense/export/auth'
import { buildFiltersLabel, parseExpenseExportFilters } from '@/lib/expense/export/filters'
import { fetchExportableExpenses } from '@/lib/expense/export/query'
import { sumExportAmounts } from '@/lib/expense/export/columns'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireExpenseExportAuth()
    if (!authResult.ok) return authResult.error

    const { auth } = authResult
    const filters = parseExpenseExportFilters(request.nextUrl.searchParams)
    const rows = await fetchExportableExpenses(auth.supabase, auth.role, filters)

    let projectName: string | null = null
    if (filters.projectId) {
      const { data } = await auth.supabase
        .from('projects')
        .select('name')
        .eq('id', filters.projectId)
        .maybeSingle()
      projectName = data?.name ?? null
    }

    return NextResponse.json({
      count: rows.length,
      totalAmount: sumExportAmounts(rows),
      filters,
      filtersLabel: buildFiltersLabel(filters, projectName),
    })
  } catch (error) {
    console.error('[expenses/export/preview]', error)
    return NextResponse.json({ error: 'Failed to preview export' }, { status: 500 })
  }
}
