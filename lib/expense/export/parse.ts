/** Split stored description into subcategory prefix and remainder. */
export function parseExpenseSubcategory(description: string): {
  subcategory: string | null
  description: string
} {
  const trimmed = description.trim()
  const dashIndex = trimmed.indexOf(' - ')
  if (dashIndex <= 0) {
    return { subcategory: null, description: trimmed }
  }
  return {
    subcategory: trimmed.slice(0, dashIndex).trim() || null,
    description: trimmed.slice(dashIndex + 3).trim() || trimmed,
  }
}

export function normalizeFilterText(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase()
}

export function matchesVendorFilter(
  vendor: string | null | undefined,
  filter: string | undefined,
): boolean {
  if (!filter?.trim()) return true
  return normalizeFilterText(vendor).includes(normalizeFilterText(filter))
}

export function matchesSubcategoryFilter(
  subcategory: string | null | undefined,
  filter: string | undefined,
): boolean {
  if (!filter?.trim()) return true
  return normalizeFilterText(subcategory) === normalizeFilterText(filter)
}
