import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { downloadQualityPhotoFile } from '@/lib/quality/storage'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

type RouteContext = {
  params: Promise<{ id: string; photoId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 })
  }

  const { id, photoId } = await context.params
  const supabase = await createClient()
  const { data: photo, error } = await supabase
    .from('quality_inspection_photos')
    .select('file_path, file_mime_type, inspection_id')
    .eq('id', photoId)
    .eq('inspection_id', id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 400 })
  }
  if (!photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  }

  const downloaded = await downloadQualityPhotoFile(supabase, photo.file_path)
  if ('error' in downloaded) {
    return NextResponse.json({ error: downloaded.error }, { status: 400 })
  }

  return new NextResponse(downloaded.data, {
    headers: {
      'Content-Type': photo.file_mime_type || downloaded.mimeType,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
