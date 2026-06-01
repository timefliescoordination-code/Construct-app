import { differenceInCalendarDays, formatDistanceToNow } from "date-fns"

const AVG_DAYS_PER_MONTH = 30.4375

export interface ProjectTimelineInput {
  startDate?: string | null
  expectedCompletionDate?: string | null
  expenseDates?: string[]
  paymentReceivedDates?: string[]
  now?: Date
}

export interface ProjectTimelineContext {
  monthsSpent: number | null
  monthsRemaining: number | null
  lastPaymentDate: Date | null
  lastExpenseDate: Date | null
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

function fractionalMonthsBetween(start: Date, end: Date): number {
  const days = differenceInCalendarDays(end, start)
  if (days <= 0) return 0
  return Math.round((days / AVG_DAYS_PER_MONTH) * 10) / 10
}

export function formatMonthsDuration(months: number): string {
  if (months <= 0) return "0 months"
  if (months === 1) return "1 month"
  const rounded = Math.round(months * 10) / 10
  return `${rounded} months`
}

export function formatRelativeTimeAgo(date: Date, now: Date = new Date()): string {
  return formatDistanceToNow(date, { addSuffix: true, includeSeconds: false })
}

export function deriveProjectTimeline(input: ProjectTimelineInput): ProjectTimelineContext {
  const now = input.now ?? new Date()
  const start = parseDate(input.startDate)
  const expectedEnd = parseDate(input.expectedCompletionDate)

  const expenseDates = (input.expenseDates ?? [])
    .map(parseDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  const paymentDates = (input.paymentReceivedDates ?? [])
    .map(parseDate)
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())

  const lastExpenseDate =
    expenseDates.length > 0 ? expenseDates[expenseDates.length - 1] : null
  const lastPaymentDate =
    paymentDates.length > 0 ? paymentDates[paymentDates.length - 1] : null

  let monthsSpent: number | null = null
  if (start) {
    const endForSpent =
      expectedEnd && expectedEnd < now && input.expectedCompletionDate
        ? expectedEnd
        : now
    monthsSpent = fractionalMonthsBetween(start, endForSpent)
  } else if (expenseDates.length > 0) {
    const first = expenseDates[0]
    const last = lastExpenseDate ?? first
    monthsSpent = fractionalMonthsBetween(first, last > now ? now : last)
    if (monthsSpent === 0 && differenceInCalendarDays(now, first) > 0) {
      monthsSpent = fractionalMonthsBetween(first, now)
    }
  }

  let monthsRemaining: number | null = null
  if (expectedEnd && expectedEnd > now) {
    monthsRemaining = fractionalMonthsBetween(now, expectedEnd)
  }

  return {
    monthsSpent,
    monthsRemaining,
    lastPaymentDate,
    lastExpenseDate,
  }
}

export function buildSpentTimelineLines(
  ctx: ProjectTimelineContext,
  now: Date = new Date(),
): string[] {
  const lines: string[] = []
  if (ctx.monthsSpent !== null && ctx.monthsSpent > 0) {
    lines.push(`${formatMonthsDuration(ctx.monthsSpent)} of spending`)
  }
  if (ctx.lastPaymentDate) {
    lines.push(`Last payment ${formatRelativeTimeAgo(ctx.lastPaymentDate, now)}`)
  } else if (ctx.lastExpenseDate) {
    lines.push(`Last expense ${formatRelativeTimeAgo(ctx.lastExpenseDate, now)}`)
  }
  if (ctx.monthsRemaining !== null && ctx.monthsRemaining > 0) {
    lines.push(`${formatMonthsDuration(ctx.monthsRemaining)} left to complete`)
  }
  return lines
}

export function buildReceivedTimelineLines(
  ctx: ProjectTimelineContext,
  now: Date = new Date(),
): string[] {
  const lines: string[] = []
  if (ctx.lastPaymentDate) {
    lines.push(`Last payment ${formatRelativeTimeAgo(ctx.lastPaymentDate, now)}`)
  }
  if (ctx.monthsSpent !== null && ctx.monthsSpent > 0) {
    lines.push(`Project active ${formatMonthsDuration(ctx.monthsSpent)}`)
  }
  return lines
}

export function buildRemainingBudgetTimelineLines(ctx: ProjectTimelineContext): string[] {
  if (ctx.monthsRemaining !== null && ctx.monthsRemaining > 0) {
    return [`${formatMonthsDuration(ctx.monthsRemaining)} until target completion`]
  }
  return []
}

export function buildPortfolioSpentTimelineLines(input: {
  projectTimelines: ProjectTimelineContext[]
  now?: Date
}): string[] {
  const now = input.now ?? new Date()
  const withSpent = input.projectTimelines
    .map((t) => t.monthsSpent)
    .filter((m): m is number => m !== null && m > 0)

  const lines: string[] = []
  if (withSpent.length > 0) {
    const avg =
      Math.round((withSpent.reduce((a, b) => a + b, 0) / withSpent.length) * 10) / 10
    lines.push(
      `Avg ${formatMonthsDuration(avg)} across ${withSpent.length} project${withSpent.length === 1 ? "" : "s"}`,
    )
  }

  const lastPayments = input.projectTimelines
    .map((t) => t.lastPaymentDate)
    .filter((d): d is Date => d !== null)
  if (lastPayments.length > 0) {
    const latest = lastPayments.reduce((a, b) => (a > b ? a : b))
    lines.push(`Last client payment ${formatRelativeTimeAgo(latest, now)}`)
  }

  return lines
}

export function projectTimelineFromProject(project: {
  start_date?: string | null
  expected_completion_date?: string | null
  expenses?: { status: string; expense_date: string }[]
  client_payments?: {
    status: string
    received_date?: string | null
    due_date?: string | null
    created_at?: string
  }[]
}): ProjectTimelineContext {
  return deriveProjectTimeline({
    startDate: project.start_date,
    expectedCompletionDate: project.expected_completion_date,
    expenseDates: (project.expenses ?? [])
      .filter((e) => e.status === "approved")
      .map((e) => e.expense_date),
    paymentReceivedDates: (project.client_payments ?? [])
      .filter((p) => p.status === "received")
      .map((p) => p.received_date || p.due_date || p.created_at || "")
      .filter(Boolean),
  })
}
