import type { ProposalItemSection, ProposalMethod } from '@/lib/proposals/constants'

export type ProposalLineInput = {
  section: ProposalItemSection
  description: string
  quantity: number | string
  unit: string
  rate: number | string
  sortOrder?: number
}

export type ProposalLineComputed = {
  section: ProposalItemSection
  description: string
  quantity: number
  unit: string
  rate: number
  price: number
  sortOrder: number
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
    const quantity = toQuantity(row.quantity)
    const rate = toQuantity(row.rate)
    return {
      section: row.section,
      description: row.description.trim(),
      quantity,
      unit: row.unit.trim(),
      rate: roundMoney(rate),
      price: linePrice(quantity, rate),
      sortOrder: row.sortOrder ?? index,
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
  if (input.method === 'sqft') {
    const hasPricing = filled.some((item) => item.section === 'built_up' || item.section === 'additional')
    if (!hasPricing) {
      return 'Add at least one item under Built-up Area or Additional Works before sharing.'
    }
  } else if (!filled.some((item) => item.section === 'boq')) {
    return 'Add at least one BOQ item before sharing.'
  }

  for (const item of filled) {
    if (!item.unit.trim()) {
      return `Unit is required for “${item.description.trim()}”.`
    }
    const quantity = toQuantity(item.quantity)
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
  return `${qty} ${unit} × ${formatMoney(rate)}`
}
