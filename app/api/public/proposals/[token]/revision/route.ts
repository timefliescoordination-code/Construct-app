import { NextResponse } from 'next/server'
import { submitPublicRevisionRequest } from '@/lib/proposals/public'
import { isSupabaseConfigured } from '@/lib/supabase/env'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Proposal unavailable' }, { status: 503 })
  }

  const { token } = await params
  const body = (await request.json().catch(() => ({}))) as { message?: string }
  const result = await submitPublicRevisionRequest(token, body.message ?? '')

  if (!result.ok) {
    const status =
      result.availability === 'unavailable'
        ? 404
        : result.availability === 'withdrawn' || result.availability === 'expired'
          ? 410
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ ok: true })
}
