import { DEFAULT_EXPENSE_CATEGORIES } from '../expense-categories/constants.ts'
import { parseExpenseSubcategory } from '../expense/export/parse.ts'
import {
  SPEND_CATEGORIES,
  type PublicExpenseSheetRow,
  type PublicSpendShare,
  type PublicSubcategoryGroup,
  type RawExpenseInput,
  type SpendCategory,
} from './types.ts'

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

export function catalogSubcategoriesFor(category: SpendCategory): string[] {
  const row = DEFAULT_EXPENSE_CATEGORIES.find((item) => item.name === category)
  return row ? [...row.subcategories] : []
}

export function matchCatalogSubcategory(
  category: SpendCategory,
  raw: string | null | undefined,
): string | null {
  if (!raw?.trim()) return null
  const normalized = raw.trim().toLowerCase()
  return (
    catalogSubcategoriesFor(category).find((name) => name.toLowerCase() === normalized) ?? null
  )
}

export function resolveSheetSubcategory(
  expense: Pick<RawExpenseInput, 'description' | 'subcategoryName'>,
): string | null {
  const fromSplit = expense.subcategoryName?.trim()
  if (fromSplit) return fromSplit
  return parseExpenseSubcategory(expense.description ?? '').subcategory
}

export function resolvePublicSubcategory(
  category: SpendCategory,
  expense: Pick<RawExpenseInput, 'description' | 'subcategoryName'>,
): string | null {
  const fromSplit = matchCatalogSubcategory(category, expense.subcategoryName)
  if (fromSplit) return fromSplit
  const parsed = parseExpenseSubcategory(expense.description ?? '')
  return matchCatalogSubcategory(category, parsed.subcategory)
}

type SharePart<K extends string> = { key: K; amount: number }

function roundPartsToNearestFive<K extends string>(
  parts: SharePart<K>[],
  targetSum: number,
): Array<{ key: K; percent: number }> {
  if (targetSum <= 0) return []

  const totals = new Map<K, number>()
  for (const part of parts) {
    if (!Number.isFinite(part.amount) || part.amount <= 0) continue
    totals.set(part.key, (totals.get(part.key) ?? 0) + part.amount)
  }

  const positive = Array.from(totals.entries()).map(([key, amount]) => ({ key, amount }))
  const total = positive.reduce((sum, row) => sum + row.amount, 0)
  if (total <= 0 || positive.length === 0) return []

  type Working = { key: K; raw: number; percent: number }
  let rows: Working[] = positive.map((row) => {
    const raw = (row.amount / total) * targetSum
    return { key: row.key, raw, percent: Math.round(raw / 5) * 5 }
  })

  rows = rows.filter((row) => row.percent > 0)
  if (rows.length === 0) {
    const largest = [...positive].sort((a, b) => b.amount - a.amount)[0]
    return largest ? [{ key: largest.key, percent: targetSum }] : []
  }

  let sum = rows.reduce((acc, row) => acc + row.percent, 0)
  let guard = 0
  while (sum !== targetSum && guard < 24) {
    guard += 1
    if (sum < targetSum) {
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

  if (sum !== targetSum) return []
  return rows.map((row) => ({ key: row.key, percent: row.percent }))
}

/**
 * Round each share to the nearest 5% and adjust so the visible rows sum to 100.
 * Returns an empty list when there is nothing reliable to publish.
 */
export function roundPercentsToNearestFive(
  parts: Array<{ category: SpendCategory; amount: number }>,
): Array<{ category: SpendCategory; percent: number }> {
  const rounded = roundPartsToNearestFive(
    parts.map((part) => ({ key: part.category, amount: part.amount })),
    100,
  )
  return SPEND_CATEGORIES.flatMap((category) => {
    const row = rounded.find((item) => item.key === category)
    return row ? [{ category: row.key, percent: row.percent }] : []
  })
}

export type ApprovedExpenseSummary = {
  spendMix: PublicSpendShare[]
  expenseSheet: PublicExpenseSheetRow[]
  subcategoriesByCategory: PublicSubcategoryGroup[]
}

function buildSheetForCategory(
  category: SpendCategory,
  parentPercent: number,
  expenses: Array<RawExpenseInput & { mappedCategory: SpendCategory }>,
): { rows: PublicExpenseSheetRow[]; names: string[] } {
  const unlabeledKey = '__unlabeled__'
  const amounts = new Map<string, { amount: number; count: number }>()

  for (const expense of expenses) {
    const amount = Number(expense.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const label = resolveSheetSubcategory(expense)
    const key = label ?? unlabeledKey
    const current = amounts.get(key) ?? { amount: 0, count: 0 }
    current.amount += amount
    current.count += 1
    amounts.set(key, current)
  }

  if (amounts.size === 0) {
    return { rows: [], names: [] }
  }

  const rounded = roundPartsToNearestFive(
    Array.from(amounts.entries()).map(([key, value]) => ({ key, amount: value.amount })),
    parentPercent,
  )

  const catalog = catalogSubcategoriesFor(category)
  const labeledKeys = Array.from(amounts.keys()).filter((key) => key !== unlabeledKey)
  const orderedKeys = [
    ...catalog.filter((name) => labeledKeys.includes(name)),
    ...labeledKeys
      .filter((name) => !catalog.includes(name))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    ...(amounts.has(unlabeledKey) ? [unlabeledKey] : []),
  ]

  const rows: PublicExpenseSheetRow[] = orderedKeys.flatMap((key) => {
    const stats = amounts.get(key)
    const roundedRow = rounded.find((item) => item.key === key)
    if (!stats) return []
    return [
      {
        category,
        subcategory: key === unlabeledKey ? null : key,
        percent: roundedRow?.percent ?? 0,
        amount: stats.amount,
        count: stats.count,
      },
    ]
  })

  return {
    rows,
    names: orderedKeys.filter((key) => key !== unlabeledKey),
  }
}

export function summarizeApprovedExpenses(
  expenses: Array<Pick<RawExpenseInput, 'amount' | 'category' | 'status' | 'description' | 'subcategoryName'>>,
): ApprovedExpenseSummary | undefined {
  const approved = expenses
    .filter((expense) => isApprovedExpense(expense.status) && Number(expense.amount) > 0)
    .map((expense) => ({
      ...expense,
      mappedCategory: mapExpenseCategory(expense.category),
    }))
  if (approved.length === 0) return undefined

  const percents = roundPercentsToNearestFive(
    approved.map((expense) => ({
      category: expense.mappedCategory,
      amount: Number(expense.amount),
    })),
  )
  if (percents.length === 0) return undefined

  const spendMix: PublicSpendShare[] = percents.map((row) => {
    const rowsForCategory = approved.filter((expense) => expense.mappedCategory === row.category)
    return {
      category: row.category,
      percent: row.percent,
      amount: rowsForCategory.reduce((sum, expense) => sum + Number(expense.amount), 0),
      count: rowsForCategory.length,
    }
  })

  const expenseSheet: PublicExpenseSheetRow[] = []
  const subcategoriesByCategory: PublicSubcategoryGroup[] = []

  for (const mix of spendMix) {
    const rowsForCategory = approved.filter((expense) => expense.mappedCategory === mix.category)
    const built = buildSheetForCategory(mix.category, mix.percent, rowsForCategory)
    expenseSheet.push(...built.rows)
    if (built.names.length) {
      subcategoriesByCategory.push({ category: mix.category, names: built.names })
    }
  }

  return { spendMix, expenseSheet, subcategoriesByCategory }
}
