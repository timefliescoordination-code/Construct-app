import { NextResponse } from 'next/server'
import { listProjectsForApi } from '@/lib/data/project-fetch'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const includeArchived =
    new URL(request.url).searchParams.get('includeArchived') === 'true'
  const summaryOnly = new URL(request.url).searchParams.get('summary') === 'true'

  const { data, error } = await listProjectsForApi({ includeArchived, summaryOnly })

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
