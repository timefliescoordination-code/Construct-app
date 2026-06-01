import { formatINR } from '@/lib/currency'
import { createAdminClient } from '@/lib/supabase/server'
import {
  answerCallbackQuery,
  downloadTelegramFile,
  editTelegramMessage,
  inlineKeyboard,
  removeKeyboard,
  replyKeyboard,
  sendTelegramMessage,
} from '@/lib/telegram/api'
import { getTelegramBotUsername } from '@/lib/telegram/config'
import {
  clearSession,
  findLinkedAccount,
  getSession,
  listProjectsForProfile,
  redeemLinkCode,
  setSession,
} from '@/lib/telegram/db'
import {
  attachTelegramReceipt,
  createTelegramExpense,
  formatExpenseSummary,
  parseQuickExpenseMessage,
  TELEGRAM_EXPENSE_CATEGORIES,
} from '@/lib/telegram/expense'
import type {
  ExpenseSessionPayload,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from '@/lib/telegram/types'
import type { UserRole } from '@/lib/types/database'

const MAIN_MENU = [['New expense', 'My projects'], ['Help', 'Unlink']]

type SessionPayload = ExpenseSessionPayload & { expenseId?: string }

async function sendMainMenu(chatId: number, greeting?: string) {
  const text =
    greeting ??
    [
      'Ready. Tap *New expense* or send /expense.',
      '',
      'Quick format (single project):',
      '`2500 Materials Cement 50 bags`',
      '(amount, category, description)',
    ].join('\n')
  await sendTelegramMessage(chatId, text, {
    replyMarkup: replyKeyboard(MAIN_MENU),
    parseMode: 'Markdown',
  })
}

async function requireLinked(chatId: number, telegramUserId: number) {
  const account = await findLinkedAccount(telegramUserId)
  if (!account) {
    await sendTelegramMessage(
      chatId,
      'Account not linked.\n\n1. Sign in to the app once\n2. Engineer dashboard → Connect Telegram\n3. Send /link YOUR_CODE here',
    )
    return null
  }
  return account
}

async function startExpenseFlow(
  chatId: number,
  profileId: string,
  role: UserRole,
  preset?: SessionPayload,
) {
  const projects = await listProjectsForProfile(profileId, role)

  if (projects.length === 0) {
    await sendTelegramMessage(
      chatId,
      'No active projects assigned. Ask your PM to assign you in the app.',
    )
    return
  }

  if (projects.length === 1) {
    await setSession(chatId, {
      state: preset?.category ? 'confirm' : 'pick_category',
      profileId,
      payload: {
        ...preset,
        projectId: projects[0].id,
        projectName: projects[0].name,
      },
    })
    if (preset?.category && preset.amount != null && preset.description) {
      const summary = { ...preset, projectName: projects[0].name }
      await setSession(chatId, { state: 'confirm', profileId, payload: summary })
      await sendTelegramMessage(chatId, formatExpenseSummary(summary), {
        replyMarkup: inlineKeyboard([
          [
            { text: 'Submit', callback_data: 'confirm:yes' },
            { text: 'Cancel', callback_data: 'confirm:no' },
          ],
        ]),
      })
      return
    }
    await promptCategory(chatId)
    return
  }

  await setSession(chatId, {
    state: 'pick_project',
    profileId,
    payload: preset ?? {},
  })
  const rows = projects.slice(0, 12).map((p) => [
    { text: p.name.slice(0, 40), callback_data: `project:${p.id}` },
  ])
  await sendTelegramMessage(chatId, 'Select project:', {
    replyMarkup: inlineKeyboard(rows),
  })
}

async function promptCategory(chatId: number) {
  const rows = TELEGRAM_EXPENSE_CATEGORIES.map((name) => [
    { text: name, callback_data: `category:${name}` },
  ])
  await sendTelegramMessage(chatId, 'Select category:', {
    replyMarkup: inlineKeyboard(rows),
  })
}

async function handleLinkCode(
  chatId: number,
  telegramUserId: number,
  code: string,
  username?: string,
) {
  const result = await redeemLinkCode({
    code,
    telegramUserId,
    telegramChatId: chatId,
    telegramUsername: username,
  })

  if (!result.ok) {
    await sendTelegramMessage(chatId, result.error)
    return
  }

  await sendMainMenu(
    chatId,
    `Linked, ${result.fullName}. You can submit expenses here without signing into the web app.`,
  )
}

async function submitExpenseFromSession(
  chatId: number,
  profileId: string,
  payload: SessionPayload,
): Promise<{ ok: true; expenseId: string } | { ok: false; error: string }> {
  if (!payload.projectId || !payload.category || !payload.description || payload.amount == null) {
    return { ok: false, error: 'Missing expense details. Send /expense to start again.' }
  }

  return createTelegramExpense({
    profileId,
    projectId: payload.projectId,
    category: payload.category,
    description: payload.description,
    amount: payload.amount,
    vendorName: payload.vendorName,
  })
}

async function handleCallbackQuery(query: TelegramCallbackQuery) {
  const chatId = query.message?.chat.id
  const data = query.data
  if (!chatId || !data) return

  await answerCallbackQuery(query.id)

  const telegramUserId = query.from.id
  const account = await requireLinked(chatId, telegramUserId)
  if (!account) return

  const session = await getSession(chatId)
  const payload = session.payload as SessionPayload

  if (data.startsWith('project:')) {
    const projectId = data.slice('project:'.length)
    const projects = await listProjectsForProfile(account.profileId, account.role)
    const project = projects.find((p) => p.id === projectId)
    if (!project) {
      await sendTelegramMessage(chatId, 'Project not found.')
      return
    }

    const nextPayload: SessionPayload = {
      ...payload,
      projectId: project.id,
      projectName: project.name,
    }

    if (nextPayload.category && nextPayload.amount != null && nextPayload.description) {
      await setSession(chatId, {
        state: 'confirm',
        profileId: account.profileId,
        payload: nextPayload,
      })
      await sendTelegramMessage(chatId, formatExpenseSummary(nextPayload))
      return
    }

    await setSession(chatId, {
      state: 'pick_category',
      profileId: account.profileId,
      payload: nextPayload,
    })
    await promptCategory(chatId)
    return
  }

  if (data.startsWith('category:')) {
    const category = data.slice('category:'.length)
    await setSession(chatId, {
      state: 'enter_amount',
      profileId: account.profileId,
      payload: { ...payload, category },
    })
    await sendTelegramMessage(chatId, `Category: ${category}\n\nEnter amount in INR:`)
    return
  }

  if (data === 'confirm:yes' && query.message) {
    const result = await submitExpenseFromSession(chatId, account.profileId, payload)
    if (!result.ok) {
      await editTelegramMessage(chatId, query.message.message_id, result.error)
      return
    }

    await setSession(chatId, {
      state: 'awaiting_receipt',
      profileId: account.profileId,
      payload: { ...payload, expenseId: result.expenseId },
    })
    await editTelegramMessage(
      chatId,
      query.message.message_id,
      'Submitted for approval.\n\nSend a bill photo/PDF or /skip.',
    )
  }

  if (data === 'confirm:no' && query.message) {
    await clearSession(chatId)
    await editTelegramMessage(chatId, query.message.message_id, 'Cancelled.')
    await sendMainMenu(chatId)
  }
}

async function handlePhotoOrDocument(message: TelegramMessage) {
  const chatId = message.chat.id
  const telegramUserId = message.from?.id
  if (!telegramUserId) return

  const session = await getSession(chatId)
  const payload = session.payload as SessionPayload

  if (session.state !== 'awaiting_receipt' || !payload.projectId || !payload.expenseId) {
    await sendTelegramMessage(chatId, 'Send /expense first, then attach a receipt when asked.')
    return
  }

  const fileId =
    message.photo?.[message.photo.length - 1]?.file_id ?? message.document?.file_id
  if (!fileId) return

  try {
    const file = await downloadTelegramFile(fileId)
    const attach = await attachTelegramReceipt({
      projectId: payload.projectId,
      expenseId: payload.expenseId,
      buffer: file.buffer,
      mimeType: message.document?.mime_type ?? file.mimeType,
      fileName: message.document?.file_name ?? file.fileName,
    })

    if (!attach.ok) {
      await sendTelegramMessage(chatId, attach.error)
      return
    }

    await clearSession(chatId)
    await sendMainMenu(chatId, 'Receipt attached. Expense is pending approval.')
  } catch {
    await sendTelegramMessage(chatId, 'Could not save the file. Try again or /skip.')
  }
}

async function handleMessage(message: TelegramMessage) {
  const chatId = message.chat.id
  const telegramUserId = message.from?.id
  if (!telegramUserId) return

  if (message.photo?.length || message.document) {
    await handlePhotoOrDocument(message)
    return
  }

  const text = message.text?.trim() ?? ''

  if (text.startsWith('/start')) {
    const linked = await findLinkedAccount(telegramUserId)
    if (linked) {
      await sendMainMenu(chatId, `Welcome back, ${linked.fullName}.`)
    } else {
      const bot = getTelegramBotUsername()
      await sendTelegramMessage(
        chatId,
        `VRA Homes expense bot (@${bot}).\n\nLink once with a code from the Engineer dashboard, then log expenses here.\n\n/link YOUR_CODE`,
      )
    }
    return
  }

  if (text.startsWith('/link')) {
    const code = text.replace(/^\/link\s*/i, '').trim()
    if (!code) {
      await sendTelegramMessage(chatId, 'Usage: /link AB12CD')
      return
    }
    await handleLinkCode(chatId, telegramUserId, code, message.from?.username)
    return
  }

  if (text === '/unlink' || text === 'Unlink') {
    const supabase = createAdminClient()
    await supabase.from('telegram_accounts').delete().eq('telegram_user_id', telegramUserId)
    await clearSession(chatId)
    await sendTelegramMessage(chatId, 'Unlinked. Generate a new code in the app to connect again.', {
      replyMarkup: removeKeyboard(),
    })
    return
  }

  if (text === '/help' || text === 'Help') {
    await sendTelegramMessage(
      chatId,
      [
        '/expense — guided expense',
        '/link CODE — connect app account',
        '/unlink — disconnect',
        '',
        'Quick: 2500 Materials Cement 50 bags',
        'Categories: Materials, Labour, Equipment, Miscellaneous',
      ].join('\n'),
    )
    return
  }

  if (text === '/expense' || text === 'New expense') {
    const account = await requireLinked(chatId, telegramUserId)
    if (!account) return
    await startExpenseFlow(chatId, account.profileId, account.role)
    return
  }

  if (text === 'My projects') {
    const account = await requireLinked(chatId, telegramUserId)
    if (!account) return
    const projects = await listProjectsForProfile(account.profileId, account.role)
    await sendTelegramMessage(
      chatId,
      projects.length
        ? projects.map((p, i) => `${i + 1}. ${p.name}`).join('\n')
        : 'No projects assigned.',
    )
    return
  }

  const session = await getSession(chatId)
  const payload = session.payload as SessionPayload
  const account = await findLinkedAccount(telegramUserId)

  if (account && session.state === 'idle' && text && !text.startsWith('/')) {
    const quick = parseQuickExpenseMessage(text)
    if (quick) {
      const projects = await listProjectsForProfile(account.profileId, account.role)
      if (projects.length === 1) {
        const result = await createTelegramExpense({
          profileId: account.profileId,
          projectId: projects[0].id,
          category: quick.category,
          description: quick.description,
          amount: quick.amount,
        })
        if (!result.ok) {
          await sendTelegramMessage(chatId, result.error)
          return
        }
        await setSession(chatId, {
          state: 'awaiting_receipt',
          profileId: account.profileId,
          payload: {
            projectId: projects[0].id,
            projectName: projects[0].name,
            category: quick.category,
            amount: quick.amount,
            description: quick.description,
            expenseId: result.expenseId,
          },
        })
        await sendTelegramMessage(
          chatId,
          `Submitted: ${formatINR(quick.amount)} · ${quick.category}\n${projects[0].name}\n\nSend a bill photo or /skip.`,
        )
        return
      }
      await startExpenseFlow(chatId, account.profileId, account.role, {
        category: quick.category,
        amount: quick.amount,
        description: quick.description,
      })
      return
    }
  }

  if (!account) {
    if (/^[A-Z0-9]{6}$/i.test(text)) {
      await handleLinkCode(chatId, telegramUserId, text, message.from?.username)
    } else {
      await sendTelegramMessage(chatId, 'Send /link YOUR_CODE from the app.')
    }
    return
  }

  if (session.state === 'enter_amount') {
    const amount = Number(text.replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      await sendTelegramMessage(chatId, 'Enter a valid amount (numbers only).')
      return
    }
    await setSession(chatId, {
      state: 'enter_description',
      profileId: account.profileId,
      payload: { ...payload, amount },
    })
    await sendTelegramMessage(chatId, 'Description (e.g. Cement 50 bags):')
    return
  }

  if (session.state === 'enter_description') {
    await setSession(chatId, {
      state: 'enter_vendor',
      profileId: account.profileId,
      payload: { ...payload, description: text },
    })
    await sendTelegramMessage(chatId, 'Vendor name (or - to skip):')
    return
  }

  if (session.state === 'enter_vendor') {
    const vendorName = text === '-' || text.toLowerCase() === 'skip' ? null : text
    const next = { ...payload, vendorName }
    await setSession(chatId, {
      state: 'confirm',
      profileId: account.profileId,
      payload: next,
    })
    await sendTelegramMessage(chatId, formatExpenseSummary(next), {
      replyMarkup: inlineKeyboard([
        [
          { text: 'Submit', callback_data: 'confirm:yes' },
          { text: 'Cancel', callback_data: 'confirm:no' },
        ],
      ]),
    })
    return
  }

  if (session.state === 'confirm') {
    const yes = /^(yes|y|ok|submit)$/i.test(text)
    const no = /^(no|n|cancel)$/i.test(text)
    if (no) {
      await clearSession(chatId)
      await sendMainMenu(chatId, 'Cancelled.')
      return
    }
    if (!yes) {
      await sendTelegramMessage(chatId, 'Reply yes to submit or no to cancel.')
      return
    }

    const result = await submitExpenseFromSession(chatId, account.profileId, payload)
    if (!result.ok) {
      await sendTelegramMessage(chatId, result.error)
      return
    }

    await setSession(chatId, {
      state: 'awaiting_receipt',
      profileId: account.profileId,
      payload: { ...payload, expenseId: result.expenseId },
    })
    await sendTelegramMessage(
      chatId,
      'Submitted for approval.\n\nSend a bill photo/PDF or /skip.',
    )
    return
  }

  if (session.state === 'awaiting_receipt') {
    if (/^\/skip$/i.test(text) || text.toLowerCase() === 'skip') {
      await clearSession(chatId)
      await sendMainMenu(chatId, 'Done.')
      return
    }
  }

  await sendTelegramMessage(chatId, 'Send /expense or /help.')
}

export async function handleTelegramUpdate(update: TelegramUpdate): Promise<void> {
  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query)
    return
  }
  if (update.message) {
    await handleMessage(update.message)
  }
}
