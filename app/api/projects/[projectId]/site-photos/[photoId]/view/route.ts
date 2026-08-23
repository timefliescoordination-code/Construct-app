import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { downloadSitePhotoFile } from '@/lib/site-photos/storage'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ projectId: string; photoId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: 'Supabase is not configured on the server.' },
      { status: 503 },
    )
  }

  const { projectId, photoId } = await context.params
  const supabase = await createClient()

  const { data: photo, error } = await supabase
    .from('project_site_photos')
    .select('file_path, file_mime_type')
    .eq('id', photoId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 400 })
  }

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  }

  const downloaded = await downloadSitePhotoFile(supabase, photo.file_path)
  if ('error' in downloaded) {
    return NextResponse.json({ error: downloaded.error }, { status: 400 })
  }

  const contentType = photo.file_mime_type || downloaded.mimeType

  return new NextResponse(downloaded.data, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
