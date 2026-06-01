export function getTelegramBotToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim()
  if (!token) {
    throw new Error(
      'TELEGRAM_BOT_TOKEN is not set. Create a bot via @BotFather and add the token to your environment.',
    )
  }
  return token
}

/** Telegram allows only A–Z, a–z, 0–9, _, - (1–256 chars). */
const WEBHOOK_SECRET_PATTERN = /^[A-Za-z0-9_-]{1,256}$/

export function getTelegramWebhookSecret(): string | null {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim()
  if (!secret) return null
  if (!WEBHOOK_SECRET_PATTERN.test(secret)) {
    console.error(
      '[telegram] TELEGRAM_WEBHOOK_SECRET has invalid characters. Use only letters, numbers, _ and -.',
    )
    return null
  }
  return secret
}

export function isValidTelegramWebhookSecret(value: string): boolean {
  return WEBHOOK_SECRET_PATTERN.test(value.trim())
}

export function getTelegramBotUsername(): string {
  return process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME?.trim() || 'YourBot'
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim())
}
