import { NextResponse } from 'next/server'
import { listLabourTypesForApi } from '@/lib/data/project-fetch'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const { data, error } = await listLabourTypesForApi()

  if (error) {
    return NextResponse.json({ error }, { status: 400 })
  }

  return NextResponse.json({ data })
}
