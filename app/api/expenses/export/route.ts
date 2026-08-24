import { NextRequest, NextResponse } from 'next/server'
import {
  getCompanyNameForExport,
  requireExpenseExportAuth,
} from '@/lib/expense/export/auth'
import { buildFiltersLabel, parseExpenseExportFilters } from '@/lib/expense/export/filters'
import {
  buildExpenseExcelBuffer,
  buildExpenseFilename,
  slugifyProjectName,
} from '@/lib/expense/export/excel'
import { buildExpensePdfBuffer } from '@/lib/expense/export/pdf'
import {
  fetchExportableExpenses,
} from '@/lib/expense/export/query'
import { summarizeExportRows } from '@/lib/expense/export/summary'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireExpenseExportAuth()
    if (!authResult.ok) return authResult.error

    const { auth } = authResult
    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get('format') === 'pdf' ? 'pdf' : 'xlsx'
    const filters = parseExpenseExportFilters(searchParams)
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

    const companyName = await getCompanyNameForExport(auth.supabase)
    const filtersLabel = buildFiltersLabel(filters, projectName)
    const projectSlug = projectName ? slugifyProjectName(projectName) : null
    const filename = buildExpenseFilename(filters, format, projectSlug)

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'No expenses match the selected filters.' },
        { status: 404 },
      )
    }

    if (format === 'pdf') {
      const buffer = buildExpensePdfBuffer({
        rows,
        filtersLabel,
        companyName,
        summary: summarizeExportRows(rows),
      })
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    const buffer = buildExpenseExcelBuffer({
      rows,
      filtersLabel,
      companyName,
    })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[expenses/export]', error)
    return NextResponse.json({ error: 'Failed to export expenses' }, { status: 500 })
  }
}
