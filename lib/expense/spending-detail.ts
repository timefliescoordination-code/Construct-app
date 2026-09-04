import { parseExpenseSubcategory } from './export/parse.ts'

export type ExpenseSpendingInput = {
  category: string
  amount: number
  status: string
  description?: string | null
  subcategoryName?: string | null
  labourTeamName?: string | null
}

export type ExpenseDetailRow = {
  category: string
  subcategory: string | null
  total: number
  approved: number
  pending: number
  count: number
}

/** Resolve the internal subcategory or labour-team label. Custom names are kept. */
export function expenseSubcategoryLabel(expense: ExpenseSpendingInput): string | null {
  const team = expense.labourTeamName?.trim()
  if (team) return team
  const fromSplit = expense.subcategoryName?.trim()
  if (fromSplit) return fromSplit
  return parseExpenseSubcategory(expense.description ?? '').subcategory
}

export function expenseLineLabels(expense: ExpenseSpendingInput): {
  subcategory: string | null
  description: string
} {
  const parsed = parseExpenseSubcategory(expense.description ?? '')
  const subcategory = expenseSubcategoryLabel(expense)
  const description =
    subcategory && parsed.subcategory?.toLowerCase() === subcategory.toLowerCase()
      ? parsed.description
      : (expense.description ?? '').trim()
  return { subcategory, description }
}

function matchesStatus(status: string, statusFilter: string | undefined): boolean {
  if (!statusFilter || statusFilter === 'all') return true
  return status === statusFilter
}

/**
 * Roll expenses into category + subcategory rows with exact rupee totals.
 * Unlabelled spend stays on a category row with a null subcategory.
 */
export function buildExpenseDetailRows(
  expenses: ExpenseSpendingInput[],
  categoryNames: string[],
  options?: { statusFilter?: string; categoryFilter?: string },
): ExpenseDetailRow[] {
  const statusFilter = options?.statusFilter ?? 'all'
  const categoryFilter = options?.categoryFilter ?? 'all'
  const filtered = expenses.filter((expense) => {
    if (!matchesStatus(expense.status, statusFilter)) return false
    if (categoryFilter !== 'all' && expense.category !== categoryFilter) return false
    return true
  })

  const keyOf = (category: string, subcategory: string | null) =>
    `${category}\0${subcategory ?? ''}`

  const byKey = new Map<string, ExpenseDetailRow>()

  const ensure = (category: string, subcategory: string | null): ExpenseDetailRow => {
    const key = keyOf(category, subcategory)
    let row = byKey.get(key)
    if (!row) {
      row = {
        category,
        subcategory,
        total: 0,
        approved: 0,
        pending: 0,
        count: 0,
      }
      byKey.set(key, row)
    }
    return row
  }

  for (const expense of filtered) {
    const category = expense.category?.trim() || 'Uncategorized'
    const amount = Number(expense.amount)
    if (!Number.isFinite(amount)) continue
    const row = ensure(category, expenseSubcategoryLabel(expense))
    row.total += amount
    row.count += 1
    if (expense.status === 'approved') row.approved += amount
    else if (expense.status === 'pending') row.pending += amount
  }

  const ordered: ExpenseDetailRow[] = []
  const seen = new Set<string>()
  const pushCategory = (category: string) => {
    const rows = Array.from(byKey.values()).filter((row) => row.category === category)
    rows.sort((a, b) => {
      if (!a.subcategory && b.subcategory) return 1
      if (a.subcategory && !b.subcategory) return -1
      return (a.subcategory ?? '').localeCompare(b.subcategory ?? '', undefined, {
        sensitivity: 'base',
      })
    })
    for (const row of rows) {
      const key = keyOf(row.category, row.subcategory)
      if (seen.has(key)) continue
      seen.add(key)
      ordered.push(row)
    }
  }

  for (const name of categoryNames) pushCategory(name)
  for (const row of byKey.values()) {
    if (!categoryNames.includes(row.category)) pushCategory(row.category)
  }

  return ordered
}
