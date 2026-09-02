import { defaultUnitForSection, type ProposalMethod } from './constants.ts'
import { hasMeasurementValues } from './boq-structure.ts'
import type { ProposalItemDraft } from './types.ts'

export function starterRowForMethod(method: ProposalMethod): ProposalItemDraft {
  if (method === 'boq') {
    return { section: 'boq', description: '', quantity: '', unit: defaultUnitForSection('boq'), rate: '', kind: 'item' }
  }
  return {
    section: 'built_up',
    description: '',
    quantity: '',
    unit: defaultUnitForSection('built_up'),
    rate: '',
  }
}

export function keepItemsWhenChangingMethod(
  items: ProposalItemDraft[],
  next: ProposalMethod,
): ProposalItemDraft[] {
  if (next === 'sqft' && !items.some((item) => item.section === 'built_up' || item.section === 'additional')) {
    return [...items, starterRowForMethod('sqft')]
  }
  if (next === 'boq' && !items.some((item) => item.section === 'boq')) {
    return [...items, starterRowForMethod('boq')]
  }
  return items
}

export function itemHasEnteredData(item: ProposalItemDraft): boolean {
  return Boolean(
    item.description.trim() ||
      item.quantity.trim() ||
      item.rate.trim() ||
      hasMeasurementValues(item.measurements),
  )
}
