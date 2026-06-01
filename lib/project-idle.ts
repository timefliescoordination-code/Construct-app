import { differenceInCalendarDays } from "date-fns"

/** Days without expense activity before the site is considered idle. */
export const DEFAULT_IDLE_THRESHOLD_DAYS = 10

export type IdleBand = "active" | "slow" | "idle" | "critical"

export interface ProjectIdleInput {
  startDate?: string | null
  status?: string | null
  /** Any expense status counts as site activity. Manpower is not used for idle. */
  expenses?: { expense_date: string }[]
  now?: Date
  idleThresholdDays?: number
}

export interface ProjectIdleStatus {
  band: IdleBand
  isIdle: boolean
  days: number
  friendlyDuration: string
  /** e.g. "Idle · 12 days" */
  label: string
  detail: string
  lastExpenseDate: Date | null
}

export const IDLE_BAND_LABELS: Record<IdleBand, string> = {
  active: "Active",
  slow: "Slow",
  idle: "Idle",
  critical: "Critical idle",
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatFriendlyIdleDuration(days: number): string {
  if (days <= 0) return "0 days"
  if (days === 1) return "1 day"
  if (days < 30) return `${days} days`
  const months = Math.floor(days / 30)
  const remDays = days % 30
  if (remDays === 0) {
    return months === 1 ? "1 month" : `${months} months`
  }
  const monthPart = months === 1 ? "1 month" : `${months} months`
  const dayPart = remDays === 1 ? "1 day" : `${remDays} days`
  return `${monthPart} ${dayPart}`
}

export function idleBandForDays(days: number, threshold: number): IdleBand {
  if (days <= threshold) return "active"
  if (days <= 20) return "slow"
  if (days <= 45) return "idle"
  return "critical"
}

function uniqueSortedExpenseDates(expenses: { expense_date: string }[]): Date[] {
  const isoSet = new Set<string>()
  for (const expense of expenses) {
    const raw = expense.expense_date?.trim()
    if (raw) isoSet.add(raw.slice(0, 10))
  }
  return [...isoSet]
    .map((iso) => parseDate(iso))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime())
}

export function deriveProjectIdleStatus(input: ProjectIdleInput): ProjectIdleStatus {
  const now = input.now ?? new Date()
  const threshold = input.idleThresholdDays ?? DEFAULT_IDLE_THRESHOLD_DAYS
  const projectStatus = input.status ?? "active"

  if (projectStatus === "completed" || projectStatus === "archived") {
    return {
      band: "active",
      isIdle: false,
      days: 0,
      friendlyDuration: "—",
      label: "—",
      detail:
        projectStatus === "completed"
          ? "Project completed"
          : "Project archived",
      lastExpenseDate: null,
    }
  }

  const expenseDates = uniqueSortedExpenseDates(input.expenses ?? [])
  const lastExpenseDate =
    expenseDates.length > 0 ? expenseDates[expenseDates.length - 1] : null
  const start = parseDate(input.startDate)

  let expenseIdleDays = 0
  if (lastExpenseDate) {
    expenseIdleDays = Math.max(0, differenceInCalendarDays(now, lastExpenseDate))
  } else if (start) {
    expenseIdleDays = Math.max(0, differenceInCalendarDays(now, start))
  }

  const isIdle = expenseIdleDays > threshold
  const band = isIdle ? idleBandForDays(expenseIdleDays, threshold) : "active"
  const friendlyDuration = formatFriendlyIdleDuration(expenseIdleDays)

  let detail: string
  if (isIdle) {
    detail = lastExpenseDate
      ? `No expenses for ${formatFriendlyIdleDuration(expenseIdleDays)} (last entry ${lastExpenseDate.toISOString().slice(0, 10)})`
      : `No expenses since project start (${formatFriendlyIdleDuration(expenseIdleDays)})`
  } else if (lastExpenseDate) {
    const since = differenceInCalendarDays(now, lastExpenseDate)
    detail =
      since === 0
        ? "Expense logged today"
        : `Last expense ${formatFriendlyIdleDuration(since)} ago`
  } else if (start) {
    detail = "No expenses recorded yet"
  } else {
    detail = "Add a project start date to track idle time"
  }

  const label = isIdle
    ? `${IDLE_BAND_LABELS[band]} · ${friendlyDuration}`
    : IDLE_BAND_LABELS.active

  return {
    band,
    isIdle,
    days: expenseIdleDays,
    friendlyDuration,
    label,
    detail,
    lastExpenseDate,
  }
}

export function projectIdleFromProject(project: {
  start_date?: string | null
  status?: string | null
  expenses?: { expense_date: string }[]
}): ProjectIdleStatus {
  return deriveProjectIdleStatus({
    startDate: project.start_date,
    status: project.status,
    expenses: project.expenses,
  })
}
