import type { ProposalItemKind, ProposalItemSection, ProposalMethod } from './constants.ts'
import {
  formatMeasurementsHint,
  isHeading,
  itemKind,
  quantityFromMeasurements,
} from './boq-structure.ts'
import type { BoqMeasurements } from './types.ts'

export type ProposalLineInput = {
  section: ProposalItemSection
  description: string
  quantity: number | string
  unit: string
  rate: number | string
  sortOrder?: number
  kind?: ProposalItemKind
  measurements?: BoqMeasurements | null
  nested?: boolean
}

export type ProposalLineComputed = {
  section: ProposalItemSection
  description: string
  quantity: number
  unit: string
  rate: number
  price: number
  sortOrder: number
  kind: ProposalItemKind
  measurements: BoqMeasurements | null
  nested: boolean
}

/** Round to paise (2 decimal places). Never format then parse. */
export function roundMoney(value: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100) / 100
}

export function toQuantity(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  return n
}

export function linePrice(quantity: number | string, rate: number | string): number {
  return roundMoney(toQuantity(quantity) * toQuantity(rate))
}

export function computeProposalLines(rows: ProposalLineInput[]): ProposalLineComputed[] {
  return rows.map((row, index) => {
    const kind = itemKind(row.kind)
    if (kind === 'heading') {
      return {
        section: row.section,
        description: row.description.trim(),
        quantity: 0,
        unit: '',
        rate: 0,
        price: 0,
        sortOrder: row.sortOrder ?? index,
        kind,
        measurements: null,
        nested: false,
      }
    }

    const quantity = quantityFromMeasurements(row.measurements, row.quantity)
    const rate = toQuantity(row.rate)
    return {
      section: row.section,
      description: row.description.trim(),
      quantity,
      unit: row.unit.trim(),
      rate: roundMoney(rate),
      price: linePrice(quantity, rate),
      sortOrder: row.sortOrder ?? index,
      kind,
      measurements: row.measurements ?? null,
      nested: Boolean(row.nested),
    }
  })
}

export function sumSection(lines: Array<{ section: string; price: number }>, section: ProposalItemSection): number {
  return roundMoney(
    lines.filter((line) => line.section === section).reduce((sum, line) => sum + Number(line.price || 0), 0),
  )
}

export function computeProposalTotals(
  method: ProposalMethod,
  lines: Array<{ section: string; price: number }>,
): {
  builtUpTotal: number
  additionalWorksTotal: number
  grandTotal: number
} {
  if (method === 'boq') {
    const grandTotal = sumSection(lines, 'boq')
    return { builtUpTotal: 0, additionalWorksTotal: 0, grandTotal }
  }

  const builtUpTotal = sumSection(lines, 'built_up')
  const additionalWorksTotal = sumSection(lines, 'additional')
  return {
    builtUpTotal,
    additionalWorksTotal,
    grandTotal: roundMoney(builtUpTotal + additionalWorksTotal),
  }
}

export type ShareValidationItem = {
  description: string
  quantity: number | string
  unit: string
  rate: number | string
  section: ProposalItemSection
  kind?: ProposalItemKind
  measurements?: BoqMeasurements | null
}

export function validateProposalForShare(input: {
  projectName: string
  projectAddress: string
  method: ProposalMethod
  items: ShareValidationItem[]
}): string | null {
  if (!input.projectName.trim()) {
    return 'Project name is required before sharing a proposal.'
  }
  if (!input.projectAddress.trim()) {
    return 'Project address is required before sharing a proposal.'
  }
  if (input.method !== 'sqft' && input.method !== 'boq') {
    return 'Choose a pricing method.'
  }

  const filled = input.items.filter((item) => item.description.trim())
  const billed = filled.filter((item) => !isHeading(item))
  if (input.method === 'sqft') {
    const hasPricing = billed.some((item) => item.section === 'built_up' || item.section === 'additional')
    if (!hasPricing) {
      return 'Add at least one item under Built-up Area or Additional Works before sharing.'
    }
  } else if (!billed.some((item) => item.section === 'boq')) {
    return 'Add at least one BOQ item before sharing.'
  }

  for (const item of billed) {
    if (!item.unit.trim()) {
      return `Unit is required for “${item.description.trim()}”.`
    }
    const quantity = quantityFromMeasurements(item.measurements, item.quantity)
    const rate = toQuantity(item.rate)
    if (!(quantity > 0)) {
      return `Enter a valid quantity for “${item.description.trim()}”.`
    }
    if (!Number.isFinite(rate) || rate < 0) {
      return `Enter a valid rate for “${item.description.trim()}”.`
    }
  }

  return null
}

export function formatAreaRateDisplay(quantity: number, unit: string, rate: number, formatMoney: (n: number) => string): string {
  const qty = Number.isInteger(quantity)
    ? quantity.toLocaleString('en-IN')
    : quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })
  const unitPart = unit.trim() ? ` ${unit}` : ''
  return `${qty}${unitPart} × ${formatMoney(rate)}`
}

export function formatBoqLineDisplay(
  item: {
    quantity: number
    unit: string
    rate: number
    measurements?: BoqMeasurements | null
  },
  formatMoney: (n: number) => string,
): string {
  const hint = formatMeasurementsHint(item.measurements)
  const base = formatAreaRateDisplay(item.quantity, item.unit, item.rate, formatMoney)
  return hint ? `${base} (${hint})` : base
}
