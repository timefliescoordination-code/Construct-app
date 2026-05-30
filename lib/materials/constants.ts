export const MATERIAL_CATEGORY_GROUPS = [
  'Civil Materials',
  'Electrical Materials',
  'Plumbing Materials',
  'Finishing Materials',
  'Hardware & Miscellaneous',
] as const

export type MaterialCategoryGroup = (typeof MATERIAL_CATEGORY_GROUPS)[number]

export const MATERIAL_INTELLIGENCE_PAGE_SIZE = 50

export const RATE_INCREASE_WARNING_THRESHOLD = 0.15

export function normalizeMaterialCategory(
  category: string | null | undefined,
): MaterialCategoryGroup {
  const value = category?.trim()
  if (
    value &&
    MATERIAL_CATEGORY_GROUPS.includes(value as MaterialCategoryGroup)
  ) {
    return value as MaterialCategoryGroup
  }
  return 'Hardware & Miscellaneous'
}

export function calculateRateChangePercent(
  latestRate: number,
  previousRate: number,
): number | null {
  if (previousRate <= 0) return null
  return ((latestRate - previousRate) / previousRate) * 100
}

export function isRateIncreasedWarning(
  latestRate: number,
  averageRate: number,
): boolean {
  if (averageRate <= 0) return false
  return latestRate > averageRate * (1 + RATE_INCREASE_WARNING_THRESHOLD)
}

export function formatRateChangePercent(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}
