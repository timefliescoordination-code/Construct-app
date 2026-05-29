import { NextResponse } from 'next/server'
import { getExpenseCategoriesForProject } from '@/lib/data/expense-categories'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ projectId: string }> }

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const { projectId } = await context.params
  const { data, error } = await getExpenseCategoriesForProject(projectId)

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
