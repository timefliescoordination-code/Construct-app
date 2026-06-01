import { getTelegramBotToken } from '@/lib/telegram/config'

const TELEGRAM_API = 'https://api.telegram.org'

async function telegramRequest<T>(
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const token = getTelegramBotToken()
  const res = await fetch(`${TELEGRAM_API}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const json = (await res.json()) as { ok: boolean; description?: string; result?: T }
  if (!json.ok) {
    throw new Error(json.description ?? `Telegram API ${method} failed`)
  }
  return json.result as T
}

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  options?: {
    replyMarkup?: Record<string, unknown>
    parseMode?: 'HTML' | 'Markdown'
  },
): Promise<void> {
  await telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options?.parseMode,
    reply_markup: options?.replyMarkup,
  })
}

export async function answerCallbackQuery(
  callbackQueryId: string,
  text?: string,
): Promise<void> {
  await telegramRequest('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
    show_alert: Boolean(text),
  })
}

export async function editTelegramMessage(
  chatId: number,
  messageId: number,
  text: string,
  replyMarkup?: Record<string, unknown>,
): Promise<void> {
  await telegramRequest('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    reply_markup: replyMarkup,
  })
}

export async function downloadTelegramFile(fileId: string): Promise<{
  buffer: ArrayBuffer
  mimeType: string
  fileName: string
}> {
  const token = getTelegramBotToken()
  const fileMeta = await telegramRequest<{ file_path: string }>('getFile', {
    file_id: fileId,
  })

  const fileRes = await fetch(
    `${TELEGRAM_API}/file/bot${token}/${fileMeta.file_path}`,
  )
  if (!fileRes.ok) {
    throw new Error('Failed to download file from Telegram')
  }

  const ext = fileMeta.file_path.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mimeType =
    ext === 'pdf'
      ? 'application/pdf'
      : ext === 'png'
        ? 'image/png'
        : 'image/jpeg'

  return {
    buffer: await fileRes.arrayBuffer(),
    mimeType,
    fileName: `telegram-receipt.${ext}`,
  }
}

export function inlineKeyboard(
  rows: { text: string; callback_data: string }[][],
): Record<string, unknown> {
  return { inline_keyboard: rows }
}

export function replyKeyboard(
  rows: string[][],
  options?: { resize?: boolean; oneTime?: boolean },
): Record<string, unknown> {
  return {
    keyboard: rows.map((row) => row.map((text) => ({ text }))),
    resize_keyboard: options?.resize ?? true,
    one_time_keyboard: options?.oneTime ?? false,
  }
}

export function removeKeyboard(): Record<string, unknown> {
  return { remove_keyboard: true }
}
