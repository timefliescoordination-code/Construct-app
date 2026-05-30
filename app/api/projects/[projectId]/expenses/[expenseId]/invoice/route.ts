import { NextResponse } from 'next/server'
import { getExpenseInvoiceDetails } from '@/lib/data/invoices'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ projectId: string; expenseId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const { projectId, expenseId } = await context.params
  const { data, error } = await getExpenseInvoiceDetails({ projectId, expenseId })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
