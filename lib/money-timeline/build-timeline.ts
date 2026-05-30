import type {
  MoneyTimelineEntry,
  MoneyTimelineFilters,
  RawExpenseRow,
  RawReceivedRow,
} from "@/lib/money-timeline/types"

export function buildExpenseSummary(descriptions: string[]): string {
  if (descriptions.length === 0) return ""
  const first = descriptions.slice(0, 3)
  const remaining = descriptions.length - first.length
  if (remaining > 0) {
    return `${first.join(", ")} +${remaining} more`
  }
  return first.join(", ")
}

function groupExpenses(expenses: RawExpenseRow[]): MoneyTimelineEntry[] {
  const groups = new Map<
    string,
    { date: string; projectId: string; projectName: string; items: RawExpenseRow[] }
  >()

  for (const expense of expenses) {
    const key = `${expense.date}|${expense.projectId}`
    const existing = groups.get(key)
    if (existing) {
      existing.items.push(expense)
    } else {
      groups.set(key, {
        date: expense.date,
        projectId: expense.projectId,
        projectName: expense.projectName,
        items: [expense],
      })
    }
  }

  const entries: MoneyTimelineEntry[] = []

  for (const group of groups.values()) {
    const sortedItems = [...group.items].sort((a, b) =>
      a.description.localeCompare(b.description),
    )
    const descriptions = sortedItems.map((item) => item.description)
    const total = sortedItems.reduce((sum, item) => sum + item.amount, 0)

    entries.push({
      id: `expense-group-${group.date}-${group.projectId}`,
      date: group.date,
      type: "expense",
      description: buildExpenseSummary(descriptions),
      summary: buildExpenseSummary(descriptions),
      projectId: group.projectId,
      projectName: group.projectName,
      amount: total,
      items: sortedItems.map((item) => ({
        id: item.id,
        description: item.description,
        amount: item.amount,
      })),
    })
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
    const dateCompare = a.date.localeCompare(b.date)
    if (dateCompare !== 0) return dateCompare
    if (a.type !== b.type) return a.type === "received" ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  return entries
}

export function filterMoneyTimeline(
  entries: MoneyTimelineEntry[],
  filters: MoneyTimelineFilters,
): MoneyTimelineEntry[] {
  return entries.filter((entry) => {
    if (filters.dateFrom && entry.date < filters.dateFrom) return false
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
