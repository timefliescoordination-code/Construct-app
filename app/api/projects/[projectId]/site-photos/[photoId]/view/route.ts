import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { createSignedSitePhotoUrl } from '@/lib/site-photos/storage'
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
    .select('file_path')
    .eq('id', photoId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 400 })
  }

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  }

  const signed = await createSignedSitePhotoUrl(supabase, photo.file_path)
  if ('error' in signed) {
    return NextResponse.json({ error: signed.error }, { status: 400 })
  }

  return NextResponse.json({ data: { url: signed.url } })
}
