import { NextResponse, type NextRequest } from 'next/server'
import { HOSTINGER_LOGIN_HTML } from '@/lib/auth/hostinger-login-html'
import { performPasswordLogin } from '@/lib/auth/password-login'
import {
  getTelegramBotUsername,
  getTelegramWebhookSecret,
  isTelegramConfigured,
  isValidTelegramWebhookSecret,
} from '@/lib/telegram/config'

export function isHostingerPublicHost(request: NextRequest) {
  const host = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    ''
  )
    .split(',')[0]
    .trim()
    .toLowerCase()
  return host === 'vraconstruction.app' || host === 'www.vraconstruction.app'
}

function htmlResponse(body: string, extraHeaders?: Record<string, string>) {
  const headers = new Headers({
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
    'cdn-cache-control': 'no-store',
    'x-vra-fallback': 'middleware',
  })
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) headers.set(key, value)
  }
  return new NextResponse(body, { status: 200, headers })
}

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      'cache-control': 'private, no-cache, no-store, max-age=0, must-revalidate',
      'cdn-cache-control': 'no-store',
      'x-vra-fallback': 'middleware',
    },
  })
}

/** Finish the request in middleware so Hostinger never hits the broken App Router renderer. */
export async function hostingerMiddlewareFallback(
  request: NextRequest,
): Promise<NextResponse | null> {
  if (!isHostingerPublicHost(request)) return null

  const { pathname } = request.nextUrl
  const method = request.method.toUpperCase()

  if (pathname === '/api/telegram/health' && method === 'GET') {
    const rawSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() ?? ''
    return jsonResponse({
      ok: true,
      via: 'middleware',
      telegramConfigured: isTelegramConfigured(),
      botUsername: getTelegramBotUsername(),
      webhookSecretSet: Boolean(rawSecret),
      webhookSecretValid: rawSecret ? isValidTelegramWebhookSecret(rawSecret) : true,
      activeSecretUsed: Boolean(getTelegramWebhookSecret()),
      webhookPath: '/api/telegram/webhook',
    })
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const response = await performPasswordLogin(request)
    response.headers.set('x-vra-fallback', 'middleware')
    response.headers.set(
      'cache-control',
      'private, no-cache, no-store, max-age=0, must-revalidate',
    )
    return response
  }

  if (pathname === '/login' && method === 'GET') {
    return htmlResponse(HOSTINGER_LOGIN_HTML)
  }

  return null
}
