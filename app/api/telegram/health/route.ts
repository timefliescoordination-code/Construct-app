import { NextResponse } from 'next/server'
import {
  getTelegramBotUsername,
  getTelegramWebhookSecret,
  isTelegramConfigured,
  isValidTelegramWebhookSecret,
} from '@/lib/telegram/config'

export const dynamic = 'force-dynamic'

/** Public health check — use after deploy to confirm Telegram API routes exist. */
export async function GET() {
  const rawSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? ''
  return NextResponse.json({
    ok: true,
    telegramConfigured: isTelegramConfigured(),
    botUsername: getTelegramBotUsername(),
    webhookSecretSet: Boolean(rawSecret),
    webhookSecretValid: rawSecret ? isValidTelegramWebhookSecret(rawSecret) : true,
    activeSecretUsed: Boolean(getTelegramWebhookSecret()),
    webhookPath: '/api/telegram/webhook',
  })
}
