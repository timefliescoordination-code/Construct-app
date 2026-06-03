export type TelegramExpenseKind = 'project' | 'company' | 'personal'

export type TelegramSessionState =
  | 'idle'
  | 'awaiting_link_code'
  | 'pick_expense_type'
  | 'pick_project'
  | 'pick_category'
  | 'pick_finance_category'
  | 'enter_amount'
  | 'enter_description'
  | 'enter_vendor'
  | 'awaiting_receipt'
  | 'confirm'

export type ExpenseSessionPayload = {
  expenseType?: TelegramExpenseKind
  projectId?: string
  projectName?: string
  category?: string
  amount?: number
  description?: string
  vendorName?: string | null
  expenseId?: string
  /** Category labels for inline buttons (company/personal). */
  categoryOptions?: string[]
}

export type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  callback_query?: TelegramCallbackQuery
}

export type TelegramMessage = {
  message_id: number
  chat: { id: number; type: string }
  from?: {
    id: number
    username?: string
    first_name?: string
    last_name?: string
  }
  text?: string
  photo?: { file_id: string; file_unique_id: string; width: number; height: number }[]
  document?: {
    file_id: string
    file_name?: string
    mime_type?: string
  }
}

export type TelegramCallbackQuery = {
  id: string
  from: { id: number; username?: string }
  message?: TelegramMessage
  data?: string
}
