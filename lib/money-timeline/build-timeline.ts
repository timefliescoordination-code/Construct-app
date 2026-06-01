import type {
  MoneyTimelineEntry,
  MoneyTimelineFilters,
  RawExpenseRow,
  RawReceivedRow,
} from "@/lib/money-timeline/types"
import {
  formatExpenseDateRange,
  rangeHasOtherProject,
} from "@/lib/money-timeline/dates"

export function buildExpenseSummary(descriptions: string[]): string {
  if (descriptions.length === 0) return ""
  const first = descriptions.slice(0, 3)
  const remaining = descriptions.length - first.length
  if (remaining > 0) {
    return `${first.join(", ")} +${remaining} more`
  }
  return first.join(", ")
}

function buildDateProjectMap(
  expenses: RawExpenseRow[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const expense of expenses) {
    const projects = map.get(expense.date) ?? new Set<string>()
    projects.add(expense.projectId)
    map.set(expense.date, projects)
  }
  return map
}

function groupExpenses(expenses: RawExpenseRow[]): MoneyTimelineEntry[] {
  if (expenses.length === 0) return []

  const dateProjects = buildDateProjectMap(expenses)
  const byProject = new Map<string, RawExpenseRow[]>()

  for (const expense of expenses) {
    const list = byProject.get(expense.projectId) ?? []
    list.push(expense)
    byProject.set(expense.projectId, list)
  }

  const entries: MoneyTimelineEntry[] = []

  for (const [projectId, projectExpenses] of byProject) {
    const projectName = projectExpenses[0]?.projectName ?? "Unknown project"
    const expenseDates = [
      ...new Set(projectExpenses.map((expense) => expense.date)),
    ].sort()

    let index = 0
    while (index < expenseDates.length) {
      const rangeStart = expenseDates[index]
      let rangeEnd = rangeStart
      let nextIndex = index + 1

      while (nextIndex < expenseDates.length) {
        const candidateEnd = expenseDates[nextIndex]
        if (rangeHasOtherProject(rangeStart, candidateEnd, projectId, dateProjects)) {
          break
        }
        rangeEnd = candidateEnd
        nextIndex += 1
      }

      const rangeItems = projectExpenses
        .filter(
          (expense) =>
            expense.date >= rangeStart && expense.date <= rangeEnd,
        )
        .sort((a, b) => {
          const dateCompare = a.date.localeCompare(b.date)
          if (dateCompare !== 0) return dateCompare
          return a.description.localeCompare(b.description)
        })

      const descriptions = rangeItems.map((item) => item.description)
      const total = rangeItems.reduce((sum, item) => sum + item.amount, 0)

      entries.push({
        id: `expense-group-${rangeStart}-${rangeEnd}-${projectId}`,
        date: rangeStart,
        endDate: rangeEnd === rangeStart ? undefined : rangeEnd,
        dateLabel: formatExpenseDateRange(rangeStart, rangeEnd),
        type: "expense",
        description: buildExpenseSummary(descriptions),
        summary: buildExpenseSummary(descriptions),
        projectId,
        projectName,
        amount: total,
        items: rangeItems.map((item) => ({
          id: item.id,
          description: item.description,
          amount: item.amount,
          date: item.date,
        })),
      })

      index = nextIndex
    }
  }

  return entries
}

function receivedEntries(payments: RawReceivedRow[]): MoneyTimelineEntry[] {
  return payments.map((payment) => ({
    id: `payment-${payment.id}`,
    date: payment.date,
    type: "received" as const,
    description: `${payment.projectName} Payment Received`,
    projectId: payment.projectId,
    projectName: payment.projectName,
    amount: payment.amount,
  }))
}

export function buildMoneyTimeline(
  payments: RawReceivedRow[],
  expenses: RawExpenseRow[],
): MoneyTimelineEntry[] {
  const entries = [...receivedEntries(payments), ...groupExpenses(expenses)]

  entries.sort((a, b) => {
    const endA = a.endDate ?? a.date
    const endB = b.endDate ?? b.date
    const dateCompare = endB.localeCompare(endA)
    if (dateCompare !== 0) return dateCompare
    if (a.type !== b.type) return a.type === "received" ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  return entries
}

function entryEndDate(entry: MoneyTimelineEntry): string {
  return entry.endDate ?? entry.date
}

export function filterMoneyTimeline(
  entries: MoneyTimelineEntry[],
  filters: MoneyTimelineFilters,
): MoneyTimelineEntry[] {
  return entries.filter((entry) => {
    const end = entryEndDate(entry)
    if (filters.dateFrom && end < filters.dateFrom) return false
    if (filters.dateTo && entry.date > filters.dateTo) return false
    if (filters.projectId && entry.projectId !== filters.projectId) return false
    if (filters.type && filters.type !== "all" && entry.type !== filters.type) {
      return false
    }
    return true
  })
}

export function paginateMoneyTimeline(
  entries: MoneyTimelineEntry[],
  offset: number,
  limit: number,
) {
  const page = entries.slice(offset, offset + limit)
  return {
    rows: page,
    total: entries.length,
    hasMore: offset + limit < entries.length,
  }
}
