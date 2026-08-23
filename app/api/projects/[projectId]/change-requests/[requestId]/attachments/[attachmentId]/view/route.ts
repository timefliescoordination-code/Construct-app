import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSignedChangeRequestUrl } from '@/lib/change-requests/storage'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ projectId: string; requestId: string; attachmentId: string }> },
) {
  const { requestId, attachmentId } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: attachment, error } = await supabase
    .from('construction_change_request_attachments')
    .select('file_path, change_request_id')
    .eq('id', attachmentId)
    .eq('change_request_id', requestId)
    .maybeSingle()

  if (error || !attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  const signed = await createSignedChangeRequestUrl(supabase, attachment.file_path)
  if ('error' in signed) {
    return NextResponse.json({ error: signed.error }, { status: 500 })
  }

  return NextResponse.redirect(signed.url)
}
