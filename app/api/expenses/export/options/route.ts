import { NextRequest, NextResponse } from 'next/server'
import { requireExpenseExportAuth } from '@/lib/expense/export/auth'
import { fetchExportFilterOptions } from '@/lib/expense/export/query'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireExpenseExportAuth()
    if (!authResult.ok) return authResult.error

    const projectId = request.nextUrl.searchParams.get('projectId') ?? undefined
    const options = await fetchExportFilterOptions(
      authResult.auth.supabase,
      authResult.auth.role,
      projectId,
    )

    return NextResponse.json(options)
  } catch (error) {
    console.error('[expenses/export/options]', error)
    return NextResponse.json({ error: 'Failed to load export options' }, { status: 500 })
  }
}
