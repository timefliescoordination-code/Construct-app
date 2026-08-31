import { NextResponse } from 'next/server'
import { getPublicProposalByToken, recordPublicProposalView } from '@/lib/proposals/public'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({
      availability: 'unavailable',
      is_historical: false,
      newer_available: false,
      current_share_path: null,
      can_request_revision: false,
      document: null,
    })
  }

  const { token } = await params
  const payload = await getPublicProposalByToken(token)
  if (payload.availability === 'ok') {
    void recordPublicProposalView(token).catch(() => {})
  }
  return NextResponse.json(payload)
}
