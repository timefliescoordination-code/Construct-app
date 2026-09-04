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

const OTHER_LABEL = 'Other'

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
): PublicSpendShare[] {
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
  const catalog = catalogSubcategoriesFor(category)
  if (catalog.length === 0) {
    return {
      rows: [{ category, subcategory: null, percent: parentPercent }],
      names: [],
    }
  }

  const amounts = new Map<string, number>()
  let leftover = 0
  const appeared = new Set<string>()

  for (const expense of expenses) {
    const amount = Number(expense.amount)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const matched = resolvePublicSubcategory(category, expense)
    if (matched) {
      amounts.set(matched, (amounts.get(matched) ?? 0) + amount)
      appeared.add(matched)
    } else {
      leftover += amount
    }
  }

  if (leftover > 0) {
    amounts.set(OTHER_LABEL, (amounts.get(OTHER_LABEL) ?? 0) + leftover)
  }

  const rounded = roundPartsToNearestFive(
    Array.from(amounts.entries()).map(([key, amount]) => ({ key, amount })),
    parentPercent,
  )

  const catalogOrder = catalog.includes(OTHER_LABEL) ? [...catalog] : [...catalog, OTHER_LABEL]
  const rows: PublicExpenseSheetRow[] = catalogOrder.flatMap((name) => {
    const row = rounded.find((item) => item.key === name)
    if (!row) return []
    return [{ category, subcategory: name, percent: row.percent }]
  })

  const leftoverRows = rounded.filter((item) => !catalogOrder.includes(item.key))
  for (const row of leftoverRows) {
    const existing = rows.find((item) => item.subcategory === OTHER_LABEL)
    if (existing) existing.percent += row.percent
    else rows.push({ category, subcategory: OTHER_LABEL, percent: row.percent })
  }

  if (rows.length === 0) {
    return {
      rows: [{ category, subcategory: null, percent: parentPercent }],
      names: [],
    }
  }

  return {
    rows,
    names: catalog.filter((name) => appeared.has(name)),
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

  const spendMix = roundPercentsToNearestFive(
    approved.map((expense) => ({
      category: expense.mappedCategory,
      amount: Number(expense.amount),
    })),
  )
  if (spendMix.length === 0) return undefined

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
