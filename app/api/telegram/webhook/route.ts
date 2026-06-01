import { NextResponse } from 'next/server'
import { getTelegramWebhookSecret, isTelegramConfigured } from '@/lib/telegram/config'
import { handleTelegramUpdate } from '@/lib/telegram/handlers'
import type { TelegramUpdate } from '@/lib/telegram/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: 'telegram-webhook',
    configured: isTelegramConfigured(),
    secretConfigured: Boolean(getTelegramWebhookSecret()),
  })
}

export async function POST(request: Request) {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 503 })
  }

  const secret = getTelegramWebhookSecret()
  if (secret) {
    const header = request.headers.get('x-telegram-bot-api-secret-token')
    if (header !== secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  try {
    await handleTelegramUpdate(update)
  } catch (error) {
    console.error('[telegram/webhook]', error)
  }

  return NextResponse.json({ ok: true })
}
