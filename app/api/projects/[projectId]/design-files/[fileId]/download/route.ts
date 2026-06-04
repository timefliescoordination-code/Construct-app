import { NextResponse } from 'next/server'
import { getWatermarkedDesignFileDownload } from '@/lib/data/design-files'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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
  const result = await getWatermarkedDesignFileDownload(projectId, fileId)

  if ('error' in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 },
    )
  }

  return new NextResponse(new Uint8Array(result.buffer), {
    headers: {
      'Content-Type': result.contentType,
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
