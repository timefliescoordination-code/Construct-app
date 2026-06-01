import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getTelegramBotToken, getTelegramWebhookSecret, isTelegramConfigured } from '@/lib/telegram/config'

/** Admin-only: register Telegram webhook URL (run once after deploy). */
export async function POST(request: Request) {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not set' }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as { baseUrl?: string }
  const origin =
    body.baseUrl?.replace(/\/$/, '') ??
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    new URL(request.url).origin

  const webhookUrl = `${origin}/api/telegram/webhook`
  const token = getTelegramBotToken()
  const secret = getTelegramWebhookSecret()

  const params = new URLSearchParams({ url: webhookUrl })
  if (secret) {
    params.set('secret_token', secret)
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/setWebhook?${params.toString()}`,
  )
  const json = (await res.json()) as { ok: boolean; description?: string }

  if (!json.ok) {
    return NextResponse.json({ error: json.description ?? 'setWebhook failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, webhookUrl })
}
