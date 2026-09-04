import type { AdditionalWorksSummary, RawAdditionalWorkInput, RawChangeRequestInput, SafeChangeCategory, ScopeChangeSummary } from './types.ts'

const SIGNIFICANT_EXCLUDED_STATUSES = new Set(['draft', 'cancelled', 'rejected'])

const CATEGORY_MAP: Record<string, SafeChangeCategory> = {
  design: 'Design',
  material: 'Material',
  electrical: 'Electrical',
  plumbing: 'Plumbing',
  finishing: 'Finishing',
  civil_work: 'Structural',
  structural: 'Structural',
}

export function isSignificantChangeRequest(status: string): boolean {
  return !SIGNIFICANT_EXCLUDED_STATUSES.has(status.trim().toLowerCase())
}

export function mapChangeRequestCategory(category: string): SafeChangeCategory | undefined {
  return CATEGORY_MAP[category.trim().toLowerCase()]
}

export function summarizeScopeChanges(
  changeRequests: RawChangeRequestInput[] | undefined,
): { summary?: ScopeChangeSummary; categories: SafeChangeCategory[] } {
  if (changeRequests == null) {
    return { categories: [] }
  }

  const significant = changeRequests.filter((row) => isSignificantChangeRequest(row.status))
  const categories = Array.from(
    new Set(
      significant
        .map((row) => mapChangeRequestCategory(row.category))
        .filter((value): value is SafeChangeCategory => Boolean(value)),
    ),
  )

  let summary: ScopeChangeSummary
  if (significant.length === 0) {
    summary = 'No significant scope changes recorded'
  } else if (significant.length <= 2) {
    summary = 'A few scope changes were recorded during construction'
  } else {
    summary = 'Several scope changes were recorded during construction'
  }

  return { summary, categories }
}

export function summarizeAdditionalWorks(
  additionalWorks: RawAdditionalWorkInput[] | undefined,
  additionalWorksValue: number | null | undefined,
): AdditionalWorksSummary | undefined {
  if (additionalWorks == null && (additionalWorksValue == null || additionalWorksValue <= 0)) {
    return undefined
  }

  const approvedCount = (additionalWorks ?? []).filter(
    (row) => row.approvalStatus.trim().toLowerCase() === 'approved',
  ).length
  const expanded = approvedCount > 0 || (additionalWorksValue ?? 0) > 0
  return expanded
    ? 'The scope expanded during construction.'
    : 'The scope remained broadly aligned with the original quotation.'
}
