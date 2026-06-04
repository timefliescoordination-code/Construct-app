import { NextResponse } from 'next/server'
import { getDesignFileViewUrl } from '@/lib/data/design-files'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ projectId: string; fileId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const { projectId, fileId } = await context.params
  const result = await getDesignFileViewUrl(projectId, fileId)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ data: { url: result.url } })
}
