import * as XLSX from 'xlsx'
import { toQuantity } from './calculations.ts'
import { MAX_BOQ_IMPORT_ROWS, defaultUnitForSection } from './constants.ts'
import type { ProposalItemDraft } from './types.ts'

type BoqField = 'description' | 'quantity' | 'unit' | 'rate' | 'amount'

export type ParsedBoqImport = {
  items: ProposalItemDraft[]
  skipped: number
  truncated: boolean
}

const TOTAL_LABEL = /^(grand\s*)?total$|^sub[\s-]*total$|^carried\s*forward$|^brought\s*forward$/i

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[₹]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function descriptionScore(value: unknown): number {
  const header = normalizeHeader(value)
  if (!header) return 0
  if (/\bdescription\b|\bparticular/.test(header)) return 3
  if (/\bitem name\b|\bdetails\b/.test(header)) return 2
  if (/^(item|items|work)$/.test(header)) return 1
  return 0
}

function classifyHeader(value: unknown): BoqField | 'ignore' {
  const header = normalizeHeader(value)
  if (!header) return 'ignore'
  if (/^(s no|sl no|sno|sr no|serial|serial no|item no|item code|code|#)$/.test(header)) return 'ignore'
  if ((/\bamount\b|\bamt\b/.test(header) || /^(total|value)$/.test(header)) && !/\brate\b/.test(header)) {
    return 'amount'
  }
  if (/\brate\b|unit price|unit rate/.test(header)) return 'rate'
  if (/\bquantity\b|\bqty\b|\bqnty\b/.test(header)) return 'quantity'
  if (/^(unit|uom|units)$/.test(header) || /\buom\b|unit of meas/.test(header)) return 'unit'
  if (descriptionScore(value) > 0) return 'description'
  return 'ignore'
}

function mapHeaderRow(row: unknown[]): Partial<Record<BoqField, number>> | null {
  const map: Partial<Record<BoqField, number>> = {}
  let bestDescriptionScore = 0
  row.forEach((cell, index) => {
    const field = classifyHeader(cell)
    if (field === 'ignore') return
    if (field === 'description') {
      const score = descriptionScore(cell)
      if (score > bestDescriptionScore) {
        map.description = index
        bestDescriptionScore = score
      }
      return
    }
    if (map[field] != null) return
    map[field] = index
  })
  if (map.description == null) return null
  if (map.quantity == null && map.rate == null && map.amount == null) return null
  return map
}

function cellText(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function formatNumber(value: unknown, money: boolean): string {
  if (value == null || value === '') return ''
  const n = toQuantity(value as number | string)
  if (!Number.isFinite(n)) return ''
  if (n === 0 && cellText(value) === '') return ''
  if (Number.isInteger(n)) return String(n)
  if (money) return String(Math.round(n * 100) / 100)
  const rounded = Math.round(n * 10000) / 10000
  return String(rounded)
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((cell) => cellText(cell) === '')
}

function positionalMap(columnCount: number): Partial<Record<BoqField, number>> {
  if (columnCount >= 6) {
    return { description: 1, unit: 2, quantity: 3, rate: 4, amount: 5 }
  }
  if (columnCount === 5) {
    return { description: 1, quantity: 2, unit: 3, rate: 4 }
  }
  if (columnCount === 4) {
    return { description: 0, quantity: 1, unit: 2, rate: 3 }
  }
  return { description: 0, quantity: 1, rate: 2 }
}

function pickCell(row: unknown[], index: number | undefined): unknown {
  if (index == null || index < 0 || index >= row.length) return ''
  return row[index]
}

function toDraft(row: unknown[], map: Partial<Record<BoqField, number>>): ProposalItemDraft | null {
  const description = cellText(pickCell(row, map.description))
  if (!description || TOTAL_LABEL.test(description)) return null

  let quantity = formatNumber(pickCell(row, map.quantity), false)
  let rate = formatNumber(pickCell(row, map.rate), true)
  const amount = formatNumber(pickCell(row, map.amount), true)
  const unit = cellText(pickCell(row, map.unit)) || defaultUnitForSection('boq')

  const qtyN = toQuantity(quantity)
  const rateN = toQuantity(rate)
  const amountN = toQuantity(amount)

  if (!quantity && !rate && amountN > 0) {
    quantity = '1'
    rate = amount
  } else if (!rate && qtyN > 0 && amountN > 0) {
    rate = formatNumber(amountN / qtyN, true)
  } else if (!quantity && rateN > 0 && amountN > 0) {
    quantity = formatNumber(amountN / rateN, false)
  }

  if (!quantity && !rate) return null

  return {
    section: 'boq',
    description,
    quantity: quantity || '1',
    unit,
    rate: rate || '0',
  }
}

export function parseBoqMatrix(rows: unknown[][]): ParsedBoqImport | { error: string } {
  const filled = rows.map((row) => (Array.isArray(row) ? row : []))
  let headerIndex = -1
  let map: Partial<Record<BoqField, number>> | null = null

  const scanLimit = Math.min(filled.length, 30)
  for (let i = 0; i < scanLimit; i++) {
    if (isBlankRow(filled[i])) continue
    const found = mapHeaderRow(filled[i])
    if (found) {
      headerIndex = i
      map = found
      break
    }
  }

  let dataStart = 0
  if (map && headerIndex >= 0) {
    dataStart = headerIndex + 1
  } else {
    const sample = filled.find((row) => !isBlankRow(row))
    if (!sample) return { error: 'The spreadsheet has no BOQ rows to import.' }
    map = positionalMap(sample.length)
    dataStart = 0
  }

  const items: ProposalItemDraft[] = []
  let skipped = 0
  let truncated = false

  for (let i = dataStart; i < filled.length; i++) {
    const row = filled[i]
    if (isBlankRow(row)) continue
    const draft = toDraft(row, map)
    if (!draft) {
      skipped += 1
      continue
    }
    if (items.length >= MAX_BOQ_IMPORT_ROWS) {
      truncated = true
      break
    }
    items.push(draft)
  }

  if (items.length === 0) {
    return {
      error:
        'No BOQ items found. Use columns Description, Qty, Unit, and Rate (Amount is optional).',
    }
  }

  return { items, skipped, truncated }
}

export function parseBoqWorkbookData(data: ArrayBuffer | Uint8Array | string): ParsedBoqImport | { error: string } {
  try {
    const workbook =
      typeof data === 'string'
        ? XLSX.read(data, { type: 'string' })
        : XLSX.read(data, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) return { error: 'The file has no sheets to import.' }
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    })
    return parseBoqMatrix(rows)
  } catch {
    return { error: 'Could not read that file. Use .xlsx, .xls, or .csv.' }
  }
}

export function mergeImportedBoqItems(
  current: ProposalItemDraft[],
  imported: ProposalItemDraft[],
): ProposalItemDraft[] {
  const kept = current.filter((item) => item.section !== 'boq')
  return [...kept, ...imported]
}

export function buildBoqTemplateWorkbook(): Uint8Array {
  const workbook = XLSX.utils.book_new()
  const sheet = XLSX.utils.aoa_to_sheet([
    ['S.No', 'Description', 'Qty', 'Unit', 'Rate'],
    [1, 'RCC foundation', 10, 'cu.ft', 150],
    [2, 'Steel reinforcement', 2, 'MT', 70000],
    [3, 'Internal plastering', 1800, 'sqft', 45],
  ])
  sheet['!cols'] = [{ wch: 8 }, { wch: 36 }, { wch: 10 }, { wch: 10 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(workbook, sheet, 'BOQ')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}
