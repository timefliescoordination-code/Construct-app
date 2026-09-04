import { SPEND_CATEGORIES, type PublicSpendShare, type SpendCategory } from './types.ts'

const CATEGORY_ALIASES: Record<string, SpendCategory> = {
  material: 'Materials',
  materials: 'Materials',
  labour: 'Labour',
  labor: 'Labour',
  wages: 'Labour',
  manpower: 'Labour',
  equipment: 'Equipment',
  machinery: 'Equipment',
  plant: 'Equipment',
  miscellaneous: 'Miscellaneous',
  misc: 'Miscellaneous',
  other: 'Miscellaneous',
  transport: 'Miscellaneous',
  transportation: 'Miscellaneous',
}

export function mapExpenseCategory(category: string): SpendCategory {
  const normalized = category.trim().toLowerCase()
  if (!normalized) return 'Miscellaneous'
  const exact = CATEGORY_ALIASES[normalized]
  if (exact) return exact
  if (normalized.includes('material')) return 'Materials'
  if (normalized.includes('labour') || normalized.includes('labor') || normalized.includes('wage')) {
    return 'Labour'
  }
  if (
    normalized.includes('equipment') ||
    normalized.includes('machinery') ||
    normalized.includes('plant')
  ) {
    return 'Equipment'
  }
  return 'Miscellaneous'
}

export function isApprovedExpense(status: string): boolean {
  return status.trim().toLowerCase() === 'approved'
}

/**
 * Round each share to the nearest 5% and adjust so the visible rows sum to 100.
 * Returns an empty list when there is nothing reliable to publish.
 */
export function roundPercentsToNearestFive(
  parts: Array<{ category: SpendCategory; amount: number }>,
): PublicSpendShare[] {
  const totals = new Map<SpendCategory, number>()
  for (const part of parts) {
    if (!Number.isFinite(part.amount) || part.amount <= 0) continue
    totals.set(part.category, (totals.get(part.category) ?? 0) + part.amount)
  }

  const positive = SPEND_CATEGORIES.map((category) => ({
    category,
    amount: totals.get(category) ?? 0,
  })).filter((row) => row.amount > 0)

  const total = positive.reduce((sum, row) => sum + row.amount, 0)
  if (total <= 0 || positive.length === 0) return []

  type Working = { category: SpendCategory; raw: number; percent: number }
  const working: Working[] = positive.map((row) => {
    const raw = (row.amount / total) * 100
    return { category: row.category, raw, percent: Math.round(raw / 5) * 5 }
  })

  let rows = working.filter((row) => row.percent > 0)
  if (rows.length === 0) return []

  let sum = rows.reduce((acc, row) => acc + row.percent, 0)
  let guard = 0
  while (sum !== 100 && guard < 24) {
    guard += 1
    if (sum < 100) {
      rows = [...rows].sort((a, b) => b.raw - b.percent - (a.raw - a.percent))
      rows[0].percent += 5
    } else {
      rows = [...rows].sort((a, b) => a.raw - a.percent - (b.raw - b.percent))
      const idx = rows.findIndex((row) => row.percent >= 5)
      if (idx < 0) break
      rows[idx].percent -= 5
      if (rows[idx].percent <= 0) {
        rows.splice(idx, 1)
        if (rows.length === 0) return []
      }
    }
    sum = rows.reduce((acc, row) => acc + row.percent, 0)
  }

  if (sum !== 100) return []

  return SPEND_CATEGORIES.flatMap((category) => {
    const row = rows.find((item) => item.category === category)
    return row ? [{ category: row.category, percent: row.percent }] : []
  })
}

export function summarizeApprovedExpenses(
  expenses: Array<{ amount: number; category: string; status: string }>,
): PublicSpendShare[] | undefined {
  const approved = expenses.filter(
    (expense) => isApprovedExpense(expense.status) && Number(expense.amount) > 0,
  )
  if (approved.length === 0) return undefined

  const mix = roundPercentsToNearestFive(
    approved.map((expense) => ({
      category: mapExpenseCategory(expense.category),
      amount: Number(expense.amount),
    })),
  )
  if (mix.length === 0) return undefined
  return mix
}
