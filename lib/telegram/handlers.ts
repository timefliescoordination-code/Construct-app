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
import {
  createTelegramCompanyExpense,
  createTelegramPersonalExpense,
  formatFinanceExpenseSummary,
  listTelegramFinanceCategories,
  parseAdminCompanyQuick,
  parseAdminPersonalQuick,
} from '@/lib/telegram/finance-expense'
import type {
  ExpenseSessionPayload,
  TelegramCallbackQuery,
  TelegramMessage,
  TelegramUpdate,
} from '@/lib/telegram/types'
import type { UserRole } from '@/lib/types/database'

const ENGINEER_MENU = [['New expense', 'My projects'], ['Help', 'Unlink']]
const ADMIN_MENU = [
  ['Project expense', 'Company expense'],
  ['Personal expense', 'Help'],
  ['Unlink'],
]

type SessionPayload = ExpenseSessionPayload & { expenseId?: string }

function mainMenuKeyboard(role: UserRole) {
  return role === 'admin' ? ADMIN_MENU : ENGINEER_MENU
}

function defaultMenuHint(role: UserRole): string {
  if (role === 'admin') {
    return [
      'Ready. Choose an expense type from the menu.',
      '',
      'Quick formats:',
      '`2500 Materials Cement 50 bags` — project',
      '`company 5000 Office Rent June rent`',
      '`personal 200 Food Lunch meeting`',
    ].join('\n')
  }
  return [
    'Ready. Tap *New expense* or send /expense.',
    '',
    'Quick format (single project):',
    '`2500 Materials Cement 50 bags`',
    '(amount, category, description)',
  ].join('\n')
}

async function sendMainMenu(
  chatId: number,
  role: UserRole,
  greeting?: string,
) {
  const text = greeting ?? defaultMenuHint(role)
  await sendTelegramMessage(chatId, text, {
    replyMarkup: replyKeyboard(mainMenuKeyboard(role)),
    parseMode: 'Markdown',
  })
}

async function requireLinked(chatId: number, telegramUserId: number) {
  const account = await findLinkedAccount(telegramUserId)
  if (!account) {
    await sendTelegramMessage(
      chatId,
      [
        'Account not linked.',
        '',
        '1. Sign in to the app once',
        '2. Sidebar → Integrations → Telegram → Get link code',
        '3. Send /link YOUR_CODE here',
      ].join('\n'),
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
        expenseType: 'project',
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
    payload: { expenseType: 'project', ...preset },
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

async function startCompanyExpenseFlow(chatId: number, profileId: string) {
  const categories = await listTelegramFinanceCategories('company_expense')
  if (!categories.length) {
    await sendTelegramMessage(chatId, 'No company categories configured.')
    return
  }
  await setSession(chatId, {
    state: 'pick_finance_category',
    profileId,
    payload: { expenseType: 'company', categoryOptions: categories },
  })
  const rows = categories.slice(0, 12).map((name, index) => [
    { text: name.slice(0, 40), callback_data: `fincat:${index}` },
  ])
  await sendTelegramMessage(chatId, 'Company expense — select category:', {
    replyMarkup: inlineKeyboard(rows),
  })
}

async function startPersonalExpenseFlow(chatId: number, profileId: string) {
  const categories = await listTelegramFinanceCategories('personal_expense')
  if (!categories.length) {
    await sendTelegramMessage(chatId, 'No personal categories configured.')
    return
  }
  await setSession(chatId, {
    state: 'pick_finance_category',
    profileId,
    payload: { expenseType: 'personal', categoryOptions: categories },
  })
  const rows = categories.slice(0, 12).map((name, index) => [
    { text: name.slice(0, 40), callback_data: `fincat:${index}` },
  ])
  await sendTelegramMessage(chatId, 'Personal expense — select category:', {
    replyMarkup: inlineKeyboard(rows),
  })
}

async function submitFinanceExpenseFromSession(
  profileId: string,
  payload: SessionPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!payload.expenseType || payload.expenseType === 'project') {
    return { ok: false, error: 'Invalid expense type.' }
  }
  if (!payload.category || !payload.description || payload.amount == null) {
    return { ok: false, error: 'Missing details. Start again from the menu.' }
  }

  if (payload.expenseType === 'company') {
    return createTelegramCompanyExpense({
      profileId,
      category: payload.category,
      description: payload.description,
      amount: payload.amount,
      vendorName: payload.vendorName,
    })
  }

  return createTelegramPersonalExpense({
    profileId,
    category: payload.category,
    description: payload.description,
    amount: payload.amount,
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

  const linked = await findLinkedAccount(telegramUserId)
  await sendMainMenu(
    chatId,
    linked?.role ?? 'engineer',
    `Linked, ${result.fullName}. You can submit expenses here without signing into the web app.`,
  )
}

async function submitExpenseFromSession(
  profileId: string,
  role: UserRole,
  payload: SessionPayload,
): Promise<{ ok: true; expenseId: string } | { ok: false; error: string }> {
  if (!payload.projectId || !payload.category || !payload.description || payload.amount == null) {
    return { ok: false, error: 'Missing expense details. Send /expense to start again.' }
  }

  return createTelegramExpense({
    profileId,
    role,
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

  if (data.startsWith('fincat:')) {
    const index = Number(data.slice('fincat:'.length))
    const options = payload.categoryOptions ?? []
    const category = options[index]
    if (!category) {
      await sendTelegramMessage(chatId, 'Category not found. Start again from the menu.')
      return
    }
    await setSession(chatId, {
      state: 'enter_amount',
      profileId: account.profileId,
      payload: { ...payload, category },
    })
    await sendTelegramMessage(chatId, `Category: ${category}\n\nEnter amount in INR:`)
    return
  }

  if (data === 'confirm:yes' && query.message) {
    if (payload.expenseType === 'company' || payload.expenseType === 'personal') {
      const result = await submitFinanceExpenseFromSession(account.profileId, payload)
      if (!result.ok) {
        await editTelegramMessage(chatId, query.message.message_id, result.error)
        return
      }
      await clearSession(chatId)
      const label =
        payload.expenseType === 'company' ? 'Company expense saved.' : 'Personal expense saved.'
      await editTelegramMessage(chatId, query.message.message_id, label)
      await sendMainMenu(chatId, account.role)
      return
    }

    const result = await submitExpenseFromSession(
      account.profileId,
      account.role,
      payload,
    )
    if (!result.ok) {
      await editTelegramMessage(chatId, query.message.message_id, result.error)
      return
    }

    const statusNote =
      account.role === 'admin'
        ? 'Saved (approved).'
        : 'Submitted for approval.'

    await setSession(chatId, {
      state: 'awaiting_receipt',
      profileId: account.profileId,
      payload: { ...payload, expenseId: result.expenseId },
    })
    await editTelegramMessage(
      chatId,
      query.message.message_id,
      `${statusNote}\n\nSend a bill photo/PDF or /skip.`,
    )
  }

  if (data === 'confirm:no' && query.message) {
    await clearSession(chatId)
    await editTelegramMessage(chatId, query.message.message_id, 'Cancelled.')
    await sendMainMenu(chatId, account.role)
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
    const linked = await findLinkedAccount(telegramUserId)
    await sendMainMenu(
      chatId,
      linked?.role ?? 'engineer',
      'Receipt attached. Expense saved.',
    )
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
      await sendMainMenu(chatId, linked.role, `Welcome back, ${linked.fullName}.`)
    } else {
      const bot = getTelegramBotUsername()
      const botLabel =
        bot === 'YourBot'
          ? 'VRA Homes expense bot'
          : `VRA Homes expense bot (@${bot})`
      await sendTelegramMessage(
        chatId,
        [
          botLabel,
          '',
          'To connect your app account:',
          '1. Sign in on the web app → Integrations → Telegram',
          '2. Tap "Get link code" (6 letters/numbers, e.g. A3F92B)',
          '3. Send here: /link A3F92B  (use your real code, not the word "CODE")',
          '',
          'You can also send the 6-character code alone.',
        ].join('\n'),
      )
    }
    return
  }

  if (text.startsWith('/link')) {
    const code = text.replace(/^\/link\s*/i, '').trim()
    if (!code) {
      await sendTelegramMessage(
        chatId,
        [
          'Send your link code from the app (Integrations → Telegram).',
          '',
          'Example: /link A3F92B',
          '',
          'Or send only the 6-character code (e.g. A3F92B).',
        ].join('\n'),
      )
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
    const linked = await findLinkedAccount(telegramUserId)
    const lines = [
      '/expense — guided project expense',
      '/link CODE — connect app account',
      '/unlink — disconnect',
      '',
      'Project quick: 2500 Materials Cement 50 bags',
      'Categories: Materials, Labour, Equipment, Miscellaneous',
    ]
    if (linked?.role === 'admin') {
      lines.push(
        '',
        'Admin menu: Project / Company / Personal expense',
        'Company quick: company 5000 Office Rent June rent',
        'Personal quick: personal 200 Food Lunch meeting',
      )
    }
    await sendTelegramMessage(chatId, lines.join('\n'))
    return
  }

  if (text === '/expense' || text === 'New expense') {
    const account = await requireLinked(chatId, telegramUserId)
    if (!account) return
    await startExpenseFlow(chatId, account.profileId, account.role)
    return
  }

  if (text === 'Project expense') {
    const account = await requireLinked(chatId, telegramUserId)
    if (!account || account.role !== 'admin') return
    await startExpenseFlow(chatId, account.profileId, account.role)
    return
  }

  if (text === 'Company expense') {
    const account = await requireLinked(chatId, telegramUserId)
    if (!account || account.role !== 'admin') return
    await startCompanyExpenseFlow(chatId, account.profileId)
    return
  }

  if (text === 'Personal expense') {
    const account = await requireLinked(chatId, telegramUserId)
    if (!account || account.role !== 'admin') return
    await startPersonalExpenseFlow(chatId, account.profileId)
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
    if (account.role === 'admin') {
      const [companyCats, personalCats] = await Promise.all([
        listTelegramFinanceCategories('company_expense'),
        listTelegramFinanceCategories('personal_expense'),
      ])
      const companyQuick = parseAdminCompanyQuick(text, companyCats)
      if (companyQuick) {
        const result = await createTelegramCompanyExpense({
          profileId: account.profileId,
          ...companyQuick,
        })
        if (!result.ok) {
          await sendTelegramMessage(chatId, result.error)
          return
        }
        await sendMainMenu(
          chatId,
          account.role,
          `Company expense saved: ${formatINR(companyQuick.amount)} · ${companyQuick.category}`,
        )
        return
      }

      const personalQuick = parseAdminPersonalQuick(text, personalCats)
      if (personalQuick) {
        const result = await createTelegramPersonalExpense({
          profileId: account.profileId,
          ...personalQuick,
        })
        if (!result.ok) {
          await sendTelegramMessage(chatId, result.error)
          return
        }
        await sendMainMenu(
          chatId,
          account.role,
          `Personal expense saved: ${formatINR(personalQuick.amount)} · ${personalQuick.category}`,
        )
        return
      }
    }

    const quick = parseQuickExpenseMessage(text)
    if (quick) {
      const projects = await listProjectsForProfile(account.profileId, account.role)
      if (projects.length === 1) {
        const result = await createTelegramExpense({
          profileId: account.profileId,
          role: account.role,
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
            expenseType: 'project',
            projectId: projects[0].id,
            projectName: projects[0].name,
            category: quick.category,
            amount: quick.amount,
            description: quick.description,
            expenseId: result.expenseId,
          },
        })
        const note =
          account.role === 'admin'
            ? 'Saved (approved).'
            : 'Submitted for approval.'
        await sendTelegramMessage(
          chatId,
          `${note} ${formatINR(quick.amount)} · ${quick.category}\n${projects[0].name}\n\nSend a bill photo or /skip.`,
        )
        return
      }
      await startExpenseFlow(chatId, account.profileId, account.role, {
        expenseType: 'project',
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
      await sendTelegramMessage(
        chatId,
        'Not linked yet. Generate a code in the app (Integrations → Telegram), then send /link followed by that code.',
      )
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
    const next = { ...payload, description: text }

    if (payload.expenseType === 'company') {
      await setSession(chatId, {
        state: 'enter_vendor',
        profileId: account.profileId,
        payload: next,
      })
      await sendTelegramMessage(chatId, 'Vendor name (or - to skip):')
      return
    }

    if (payload.expenseType === 'personal') {
      await setSession(chatId, {
        state: 'confirm',
        profileId: account.profileId,
        payload: next,
      })
      await sendTelegramMessage(chatId, formatFinanceExpenseSummary(next), {
        replyMarkup: inlineKeyboard([
          [
            { text: 'Submit', callback_data: 'confirm:yes' },
            { text: 'Cancel', callback_data: 'confirm:no' },
          ],
        ]),
      })
      return
    }

    await setSession(chatId, {
      state: 'enter_vendor',
      profileId: account.profileId,
      payload: next,
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
    const summary =
      next.expenseType === 'company' || next.expenseType === 'personal'
        ? formatFinanceExpenseSummary(next)
        : formatExpenseSummary(next)
    await sendTelegramMessage(chatId, summary, {
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
      await sendMainMenu(chatId, account.role, 'Cancelled.')
      return
    }
    if (!yes) {
      await sendTelegramMessage(chatId, 'Reply yes to submit or no to cancel.')
      return
    }

    if (payload.expenseType === 'company' || payload.expenseType === 'personal') {
      const result = await submitFinanceExpenseFromSession(account.profileId, payload)
      if (!result.ok) {
        await sendTelegramMessage(chatId, result.error)
        return
      }
      await clearSession(chatId)
      await sendMainMenu(chatId, account.role, 'Expense saved.')
      return
    }

    const result = await submitExpenseFromSession(
      account.profileId,
      account.role,
      payload,
    )
    if (!result.ok) {
      await sendTelegramMessage(chatId, result.error)
      return
    }

    const statusNote =
      account.role === 'admin'
        ? 'Saved (approved).'
        : 'Submitted for approval.'

    await setSession(chatId, {
      state: 'awaiting_receipt',
      profileId: account.profileId,
      payload: { ...payload, expenseId: result.expenseId },
    })
    await sendTelegramMessage(
      chatId,
      `${statusNote}\n\nSend a bill photo/PDF or /skip.`,
    )
    return
  }

  if (session.state === 'awaiting_receipt') {
    if (/^\/skip$/i.test(text) || text.toLowerCase() === 'skip') {
      await clearSession(chatId)
      await sendMainMenu(chatId, account.role, 'Done.')
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
