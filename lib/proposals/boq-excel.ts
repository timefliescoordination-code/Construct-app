import * as XLSX from 'xlsx'
import { toQuantity } from './calculations.ts'
import { MAX_BOQ_IMPORT_ROWS, defaultUnitForSection } from './constants.ts'
import { hasMeasurementValues, quantityFromMeasurements } from './boq-structure.ts'
import type { BoqMeasurements, ProposalItemDraft } from './types.ts'

type BoqField =
  | 'description'
  | 'quantity'
  | 'unit'
  | 'rate'
  | 'amount'
  | 'nos'
  | 'length'
  | 'breadth'
  | 'height'

type HeaderMap = Partial<Record<BoqField, number>> & {
  descriptionSecondary?: number
}

export type ParsedBoqImport = {
  items: ProposalItemDraft[]
  skipped: number
  truncated: boolean
}

const TOTAL_LABEL = /^(grand\s*)?total$|^sub[\s-]*total$|^carried\s*forward$|^brought\s*forward$/i
const LETTERED_CHILD = /^(?:\(?[a-z]\)|[a-z][.)]|[ivxlcdm]+[.)])\s+/i
const UNIT_TOKEN =
  /\b(cft|cu\.?\s*ft|cum|cu\.?\s*m|m3|m³|sqm|sq\.?\s*m|sqft|sft|rft|rmt|rm|nos|no|kg|mt|ton|tonne|bag|bags|job|ls|item|each|ltr|litre|liter)\b/i

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
  if (/\bdescription\b|\bparticular/.test(header)) return 5
  if (/\bsub[ -]?group\b|\bsub[ -]?item\b|\bwork item\b|\bactivity\b/.test(header)) return 4
  if (/\bitem name\b|\bdetails\b|\bspecification\b|\bspec\b/.test(header)) return 3
  if (/^(group|heading|category|head)$/.test(header)) return 2
  if (/^(item|items|work)$/.test(header)) return 1
  return 0
}

function classifyMeasurementHeader(value: unknown): Exclude<BoqField, 'description' | 'unit' | 'rate' | 'amount'> | null {
  const header = normalizeHeader(value)
  if (!header) return null
  if (/^(nos|no|nos no|number)$/.test(header) || header === 'n') return 'nos'
  if (/^(l|len|length)$/.test(header)) return 'length'
  if (/^(b|br|breadth|width|w)$/.test(header)) return 'breadth'
  if (/^(h|ht|height|d|dep|depth|thick|thickness)$/.test(header)) return 'height'
  if (/^(qty|qnty|quantity|qty qty)$/.test(header)) return 'quantity'
  return null
}

function classifyHeader(value: unknown): BoqField | 'ignore' {
  const header = normalizeHeader(value)
  if (!header) return 'ignore'
  if (/^(s no|sl no|slno|sno|sr no|serial|serial no|item no|item code|code|#)$/.test(header)) return 'ignore'
  const measurement = classifyMeasurementHeader(value)
  if (measurement && measurement !== 'quantity') return measurement
  if ((/\bamount\b|\bamt\b/.test(header) || /^(total|value|total amount)$/.test(header)) && !/\brate\b/.test(header)) {
    return 'amount'
  }
  if (/\brate\b|unit price|unit rate/.test(header)) return 'rate'
  if (/\bquantity\b|\bqty\b|\bqnty\b/.test(header)) return 'quantity'
  if (/^(unit|uom|units)$/.test(header) || /\buom\b|unit of meas/.test(header)) return 'unit'
  if (descriptionScore(value) > 0) return 'description'
  return 'ignore'
}

function mapHeaderRow(row: unknown[]): HeaderMap | null {
  const map: HeaderMap = {}
  const descriptionCols: Array<{ index: number; score: number }> = []
  row.forEach((cell, index) => {
    const field = classifyHeader(cell)
    if (field === 'ignore') return
    if (field === 'description') {
      descriptionCols.push({ index, score: descriptionScore(cell) })
      return
    }
    if (map[field] != null) return
    map[field] = index
  })
  descriptionCols.sort((a, b) => b.score - a.score || a.index - b.index)
  if (descriptionCols[0]) map.description = descriptionCols[0].index
  if (descriptionCols[1]) map.descriptionSecondary = descriptionCols[1].index
  if (map.description == null) return null
  if (
    map.quantity == null &&
    map.rate == null &&
    map.amount == null &&
    map.nos == null &&
    map.length == null &&
    map.breadth == null &&
    map.height == null
  ) {
    return null
  }
  return map
}

function looksLikeSubHeaderRow(row: unknown[]): boolean {
  let measurementCells = 0
  let otherText = 0
  for (const cell of row) {
    const header = normalizeHeader(cell)
    if (!header) continue
    if (classifyMeasurementHeader(cell)) {
      measurementCells += 1
      continue
    }
    if (descriptionScore(cell) > 0 || classifyHeader(cell) === 'rate' || classifyHeader(cell) === 'unit') {
      otherText += 1
      continue
    }
    if (/^[a-z]{1,12}$/.test(header)) otherText += 1
  }
  return measurementCells >= 2 && measurementCells >= otherText
}

function mergeSubHeaderRow(map: HeaderMap, subRow: unknown[]): HeaderMap {
  const next: HeaderMap = { ...map }
  subRow.forEach((cell, index) => {
    const field = classifyMeasurementHeader(cell)
    if (!field) return
    if (field !== 'quantity' && next.quantity === index) {
      delete next.quantity
    }
    if (next[field] == null) next[field] = index
  })
  return next
}

function cellText(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function parseBoqNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const text = String(value ?? '')
    .replace(/[₹]/g, '')
    .replace(/\b(?:rs|inr)\.?\b/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim()
  if (!text) return Number.NaN
  const n = Number(text)
  return Number.isFinite(n) ? n : Number.NaN
}

function formatNumber(value: unknown, money: boolean): string {
  if (value == null || value === '') return ''
  const n = parseBoqNumber(value)
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

function isLetteredChild(description: string): boolean {
  return LETTERED_CHILD.test(description.trim())
}

function outlineDepth(description: string): number {
  const match = description.match(/^(\d+(?:\.\d+)*)[.)]?\s+/)
  if (match?.[1]) return match[1].split('.').filter(Boolean).length
  if (isLetteredChild(description)) return 2
  return 1
}

function isOutlineChild(description: string): boolean {
  return outlineDepth(description) > 1 || isLetteredChild(description)
}

function positionalMap(columnCount: number): HeaderMap {
  if (columnCount >= 7) {
    return { descriptionSecondary: 1, description: 2, quantity: 3, unit: 4, rate: 5, amount: 6 }
  }
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

function columnStats(rows: unknown[][], col: number, sample: number) {
  let numeric = 0
  let unitish = 0
  let text = 0
  let filled = 0
  let textLength = 0
  const limit = Math.min(rows.length, sample)
  for (let i = 0; i < limit; i++) {
    const raw = rows[i]?.[col]
    const value = cellText(raw)
    if (!value) continue
    filled += 1
    if (Number.isFinite(parseBoqNumber(raw)) && !UNIT_TOKEN.test(value)) {
      numeric += 1
      continue
    }
    if (UNIT_TOKEN.test(value) && value.length <= 12) {
      unitish += 1
      continue
    }
    text += 1
    textLength += value.length
  }
  return { filled, numeric, unitish, text, avgText: text ? textLength / text : 0 }
}

function looksLikeSerialColumn(rows: unknown[][], col: number): boolean {
  const values = rows
    .map((row) => parseBoqNumber(row[col]))
    .filter((n) => Number.isFinite(n))
  if (values.length < 2) return false
  const ints = values.filter((n) => Number.isInteger(n) && n >= 0 && n <= 200)
  if (ints.length < values.length * 0.75) return false
  if ((ints[0] ?? 99) > 9) return false
  let smallSteps = 0
  for (let i = 1; i < ints.length; i++) {
    const delta = (ints[i] ?? 0) - (ints[i - 1] ?? 0)
    if (delta >= 0 && delta <= 5) smallSteps += 1
  }
  return smallSteps >= Math.ceil((ints.length - 1) * 0.5)
}

function inferHeaderMap(rows: unknown[][]): HeaderMap | null {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  if (width < 3) return null
  const sample = rows.slice(0, 25)
  const stats = Array.from({ length: width }, (_, col) => ({ col, ...columnStats(sample, col, 25) }))
  const used = new Set<number>()

  for (const col of stats) {
    if (looksLikeSerialColumn(sample, col.col)) used.add(col.col)
  }

  const description = [...stats]
    .filter((col) => !used.has(col.col) && col.text > 0 && col.avgText >= 8)
    .sort((a, b) => b.avgText * b.text - a.avgText * a.text)[0]
  if (!description) return null
  used.add(description.col)

  const unit = [...stats]
    .filter((col) => !used.has(col.col) && col.unitish >= Math.max(1, col.filled * 0.35))
    .sort((a, b) => b.unitish - a.unitish)[0]
  if (unit) used.add(unit.col)

  const numericCols = [...stats]
    .filter((col) => !used.has(col.col) && col.numeric >= 2 && col.numeric >= col.text)
    .sort((a, b) => a.col - b.col)

  const map: HeaderMap = { description: description.col }
  if (unit) map.unit = unit.col
  if (numericCols[0]) map.quantity = numericCols[0].col
  if (numericCols[1]) map.rate = numericCols[1].col
  if (numericCols[2]) map.amount = numericCols[2].col
  else if (numericCols.length === 1) {
    map.amount = numericCols[0].col
    delete map.quantity
  }
  if (map.quantity == null && map.rate == null && map.amount == null) return null
  return map
}

function unusedTextColumn(rows: unknown[][], map: HeaderMap, from: number): number | null {
  const width = rows.reduce((max, row) => Math.max(max, row.length), 0)
  const mapped = new Set(
    [map.description, map.descriptionSecondary, map.quantity, map.unit, map.rate, map.amount, map.nos, map.length, map.breadth, map.height].filter(
      (index): index is number => index != null,
    ),
  )
  let best: { col: number; score: number } | null = null
  for (let col = 0; col < width; col++) {
    if (mapped.has(col)) continue
    const stats = columnStats(rows.slice(from, from + 25), col, 25)
    if (stats.text < 3 || stats.avgText < 10) continue
    const score = stats.text * stats.avgText
    if (!best || score > best.score) best = { col, score }
  }
  return best?.col ?? null
}

function refineDescriptionColumn(map: HeaderMap, rows: unknown[][], from: number): HeaderMap {
  const sample = rows.slice(from, from + 25)
  const current = columnStats(sample, map.description ?? -1, 25)
  if (current.text >= 3 && current.avgText >= 8) return map
  const fallback = unusedTextColumn(rows, map, from)
  if (fallback == null) return map
  return {
    ...map,
    descriptionSecondary: map.description,
    description: fallback,
  }
}

function pickCell(row: unknown[], index: number | undefined): unknown {
  if (index == null || index < 0 || index >= row.length) return ''
  return row[index]
}

function looksLikeSerialLabel(value: string): boolean {
  return /^(?:\d+(?:\.\d+)*|[a-z]|[ivxlcdm]+)[.)]?$/i.test(value.trim())
}

function rowDescription(row: unknown[], map: HeaderMap): string {
  const primary = cellText(pickCell(row, map.description))
  const secondary = cellText(pickCell(row, map.descriptionSecondary))
  if (!primary) return secondary
  if (!secondary || secondary === primary || looksLikeSerialLabel(secondary)) return primary
  if (secondary.length <= 4 && primary.length > 12) return primary
  return `${secondary} — ${primary}`
}

function rowHasPricing(quantity: string, rate: string, amount: string, measurements: BoqMeasurements | null): boolean {
  return Boolean(quantity || rate || amount || hasMeasurementValues(measurements))
}

function measurementsFromRow(row: unknown[], map: HeaderMap): BoqMeasurements | null {
  if (map.nos == null && map.length == null && map.breadth == null && map.height == null) {
    return null
  }
  const measurements: BoqMeasurements = {
    nos: formatNumber(pickCell(row, map.nos), false),
    length: formatNumber(pickCell(row, map.length), false),
    breadth: formatNumber(pickCell(row, map.breadth), false),
    height: formatNumber(pickCell(row, map.height), false),
  }
  return hasMeasurementValues(measurements) ? measurements : null
}

function toDraft(row: unknown[], map: HeaderMap): ProposalItemDraft | null {
  const description = rowDescription(row, map)
  if (!description || TOTAL_LABEL.test(description)) return null

  let quantity = formatNumber(pickCell(row, map.quantity), false)
  let rate = formatNumber(pickCell(row, map.rate), true)
  const amount = formatNumber(pickCell(row, map.amount), true)
  const measurements = measurementsFromRow(row, map)

  const qtyN = parseBoqNumber(quantity)
  const rateN = parseBoqNumber(rate)
  const amountN = parseBoqNumber(amount)

  if (!quantity && !rate && amountN > 0) {
    quantity = '1'
    rate = amount
  } else if (!rate && qtyN > 0 && amountN > 0) {
    rate = formatNumber(amountN / qtyN, true)
  } else if (!quantity && rateN > 0 && amountN > 0) {
    quantity = formatNumber(amountN / rateN, false)
  }

  if (!rowHasPricing(quantity, rate, amount, measurements)) {
    return {
      section: 'boq',
      description,
      quantity: '',
      unit: '',
      rate: '',
      kind: 'heading',
      measurements: null,
      nested: false,
    }
  }

  if (hasMeasurementValues(measurements) && !quantity) {
    quantity = formatNumber(quantityFromMeasurements(measurements, 0), false) || '1'
  }

  const unit = cellText(pickCell(row, map.unit))

  return {
    section: 'boq',
    description,
    quantity: quantity || (isLetteredChild(description) ? '' : '1'),
    unit: unit || (isLetteredChild(description) ? '' : defaultUnitForSection('boq')),
    rate: rate || '0',
    kind: 'item',
    measurements,
    nested: false,
  }
}

function nearlyEqual(a: number, b: number): boolean {
  if (!(a > 0) || !(b > 0)) return false
  return Math.abs(a - b) / Math.max(a, b) <= 0.02
}

function inheritParentTakeoff(items: ProposalItemDraft[]): ProposalItemDraft[] {
  let parentQty = ''
  let parentUnit = ''
  return items.map((item) => {
    if (!isLetteredChild(item.description)) {
      if (toQuantity(item.quantity) > 0) parentQty = item.quantity
      if (item.unit.trim()) parentUnit = item.unit
      return item
    }
    let quantity = item.quantity
    let unit = item.unit
    if (!toQuantity(quantity) && parentQty) quantity = parentQty
    if (!unit.trim() && parentUnit && (!quantity || nearlyEqual(toQuantity(quantity), toQuantity(parentQty)))) {
      unit = parentUnit
    }
    if (!unit.trim() && parentUnit && !toQuantity(item.quantity) && !toQuantity(item.rate)) {
      unit = parentUnit
    }
    return {
      ...item,
      quantity: quantity || item.quantity,
      unit: unit || defaultUnitForSection('boq'),
      nested: true,
    }
  })
}

function promoteParentsOfLetteredChildren(items: ProposalItemDraft[]): ProposalItemDraft[] {
  return items.map((item, index) => {
    if (item.kind === 'heading' || isLetteredChild(item.description)) return item
    const next = items[index + 1]
    if (!next || !isLetteredChild(next.description)) return item
    return { ...item, kind: 'heading', quantity: '', unit: '', rate: '', measurements: null, nested: false }
  })
}

function promoteNumberedParents(items: ProposalItemDraft[]): ProposalItemDraft[] {
  return items.map((item, index) => {
    if (item.kind === 'heading') return item
    const depth = outlineDepth(item.description)
    if (depth !== 1) return item
    const next = items[index + 1]
    if (!next || next.kind === 'heading') return item
    if (outlineDepth(next.description) <= depth) return item
    const qty = toQuantity(item.quantity)
    const rate = toQuantity(item.rate)
    if (qty > 0 || rate > 0 || hasMeasurementValues(item.measurements)) return item
    return { ...item, kind: 'heading', quantity: '', unit: '', rate: '', measurements: null, nested: false }
  })
}

function assignNesting(items: ProposalItemDraft[]): ProposalItemDraft[] {
  let mode: 'none' | 'all' | 'outline' = 'none'
  return items.map((item, index) => {
    if (item.kind === 'heading') {
      const next = items[index + 1]
      mode = next && next.kind !== 'heading' && isOutlineChild(next.description) ? 'outline' : 'all'
      return { ...item, nested: false }
    }
    if (mode === 'outline') {
      if (isOutlineChild(item.description)) return { ...item, nested: true }
      mode = 'none'
      return { ...item, nested: false }
    }
    if (mode === 'all') return { ...item, nested: true }
    return { ...item, nested: false }
  })
}

function parseRowsWithMap(filled: unknown[][], map: HeaderMap, dataStart: number): ParsedBoqImport {
  const items: ProposalItemDraft[] = []
  let skipped = 0
  let truncated = false

  for (let i = dataStart; i < filled.length; i++) {
    const row = filled[i]
    if (!row || isBlankRow(row)) continue
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

  return {
    items: assignNesting(promoteNumberedParents(promoteParentsOfLetteredChildren(inheritParentTakeoff(items)))),
    skipped,
    truncated,
  }
}

export function parseBoqMatrix(rows: unknown[][]): ParsedBoqImport | { error: string } {
  const filled = rows.map((row) => (Array.isArray(row) ? row : []))
  let headerIndex = -1
  let map: HeaderMap | null = null

  const scanLimit = Math.min(filled.length, 40)
  for (let i = 0; i < scanLimit; i++) {
    if (isBlankRow(filled[i] ?? [])) continue
    const found = mapHeaderRow(filled[i] ?? [])
    if (found) {
      headerIndex = i
      map = found
      const sub = filled[i + 1]
      if (sub && looksLikeSubHeaderRow(sub)) {
        map = mergeSubHeaderRow(found, sub)
        headerIndex = i + 1
      }
      break
    }
  }

  let dataStart = 0
  if (map && headerIndex >= 0) {
    dataStart = headerIndex + 1
    map = refineDescriptionColumn(map, filled, dataStart)
  } else {
    const dataRows = filled.filter((row) => !isBlankRow(row))
    if (dataRows.length === 0) return { error: 'The spreadsheet has no BOQ rows to import.' }
    map = inferHeaderMap(dataRows) ?? positionalMap(dataRows[0]?.length ?? 0)
    dataStart = 0
  }

  let parsed = parseRowsWithMap(filled, map, dataStart)
  if (parsed.items.length === 0) {
    const dataRows = filled.filter((row) => !isBlankRow(row))
    const inferred = inferHeaderMap(dataRows.slice(dataStart))
    if (inferred) parsed = parseRowsWithMap(filled, inferred, dataStart)
  }

  if (parsed.items.length === 0) {
    return {
      error:
        'No BOQ items found. Use Description (or Group / Sub-group), Qty, Unit, and Rate. Total/Amount is optional. Group headings and a/b/c sub-items are supported.',
    }
  }

  return parsed
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
    ['S.No', 'Description', 'Nos', 'L', 'B', 'H', 'Qty', 'Unit', 'Rate'],
    ['1', 'Concrete quantity', '', '', '', '', '', '', ''],
    ['1.1', 'Steel', '', '', '', '', 2, 'MT', 70000],
    ['1.2', 'Shuttering', '', '', '', '', 50, 'sqft', 45],
    ['1.3', 'Concrete', 1, 10, 10, 1, 100, 'cu.ft', 150],
    ['2', 'RCC foundation', '', '', '', '', 10, 'cu.ft', 150],
  ])
  sheet['!cols'] = [
    { wch: 8 },
    { wch: 28 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(workbook, sheet, 'BOQ')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array
}
