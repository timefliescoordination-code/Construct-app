import { costBandFromRupees, durationBandFromDates, sizeBandFromSqft } from './bands.ts'
import { summarizeAdditionalWorks, summarizeScopeChanges } from './change-summary.ts'
import { summarizeApprovedExpenses } from './expense-summary.ts'
import { anonymousProjectTitle } from './fake-title.ts'
import { mapProjectMilestones } from './milestone-mapper.ts'
import { mapInspectionWorkTypes } from './quality-mapper.ts'
import type { PublicCaseStudy, PublicProposalMethod, RawProjectInput } from './types.ts'

const SQFT_UNIT = /^(sq\.?\s*ft|sqft|sft)$/i

export function isSqftUnit(unit: string | null | undefined): boolean {
  if (!unit) return false
  return SQFT_UNIT.test(unit.trim())
}

export function builtUpSqftFromItems(
  items: Array<{ section?: string | null; quantity?: number | string | null; unit?: string | null }>,
): number | null {
  let total = 0
  let found = false
  for (const item of items) {
    if ((item.section ?? '').trim().toLowerCase() !== 'built_up') continue
    if (!isSqftUnit(item.unit)) continue
    const quantity = Number(item.quantity)
    if (!Number.isFinite(quantity) || quantity <= 0) continue
    total += quantity
    found = true
  }
  return found ? total : null
}

export function proposalMethodLabel(
  method: 'sqft' | 'boq' | null | undefined,
): PublicProposalMethod | undefined {
  if (method === 'sqft') return 'Quoted on a built-up-area basis'
  if (method === 'boq') return 'Based on an itemized BOQ'
  return undefined
}

/**
 * Convert a real project into public case-study fields.
 * Identity, locations, dates, exact money, and custom wording are dropped here —
 * before any markdown is written.
 */
export function sanitizeProject(raw: RawProjectInput): PublicCaseStudy {
  const builtUp = raw.proposal?.builtUpQuantity
  const sizeBand = sizeBandFromSqft(builtUp ?? null)
  const costBand = costBandFromRupees(raw.contractValue)
  const durationBand = durationBandFromDates(raw.startDate, raw.expectedCompletionDate)
  const expenseSummary = summarizeApprovedExpenses(raw.expenses)
  const stages = mapProjectMilestones(raw.milestones)
  const qualityAreas = mapInspectionWorkTypes(raw.inspectionWorkTypes)
  const scope = summarizeScopeChanges(raw.changeRequests)
  const additionalWorksSummary = summarizeAdditionalWorks(
    raw.additionalWorks,
    raw.additionalWorksValue,
  )

  return {
    title: anonymousProjectTitle(raw.id),
    buildingType: 'Residential construction',
    sizeBand,
    costBand,
    durationBand,
    proposalMethod: proposalMethodLabel(raw.proposal?.method),
    spendMix: expenseSummary?.spendMix,
    expenseSheet: expenseSummary?.expenseSheet,
    expenseLines: expenseSummary?.expenseLines,
    subcategoriesByCategory: expenseSummary?.subcategoriesByCategory,
    stages,
    qualityAreas,
    scopeChangeSummary: scope.summary,
    scopeChangeCategories: scope.categories,
    additionalWorksSummary,
  }
}
