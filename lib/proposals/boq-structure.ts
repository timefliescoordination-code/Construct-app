import type { ProposalItemKind } from './constants.ts'
import type { BoqMeasurements } from './types.ts'

function toQty(value: number | string): number {
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n)) return 0
  return n
}

export const EMPTY_BOQ_MEASUREMENTS: BoqMeasurements = {
  nos: '',
  length: '',
  breadth: '',
  height: '',
}

export function itemKind(value: unknown): ProposalItemKind {
  return value === 'heading' ? 'heading' : 'item'
}

export function isHeading(item: { kind?: unknown }): boolean {
  return itemKind(item.kind) === 'heading'
}

export function emptyBoqMeasurements(): BoqMeasurements {
  return { ...EMPTY_BOQ_MEASUREMENTS }
}

function measurementText(value: unknown): string {
  if (value == null || value === '') return ''
  if (typeof value === 'number' && Number.isFinite(value)) {
    if (Number.isInteger(value)) return String(value)
    return String(Math.round(value * 10000) / 10000)
  }
  const text = String(value).replace(/,/g, '').trim()
  return text
}

export function measurementsFromUnknown(value: unknown): BoqMeasurements | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const next: BoqMeasurements = {
    nos: measurementText(record.nos),
    length: measurementText(record.length),
    breadth: measurementText(record.breadth),
    height: measurementText(record.height),
  }
  if (!next.nos && !next.length && !next.breadth && !next.height) {
    return { ...EMPTY_BOQ_MEASUREMENTS }
  }
  return next
}

export function measurementsToJson(value: BoqMeasurements | null | undefined): BoqMeasurements | null {
  if (!value) return null
  return {
    nos: String(value.nos ?? '').trim(),
    length: String(value.length ?? '').trim(),
    breadth: String(value.breadth ?? '').trim(),
    height: String(value.height ?? '').trim(),
  }
}

export function rowUsesMeasurements(item: { measurements?: BoqMeasurements | null }): boolean {
  return item.measurements != null
}

export function hasMeasurementValues(value: BoqMeasurements | null | undefined): boolean {
  if (!value) return false
  return [value.nos, value.length, value.breadth, value.height].some((part) => String(part ?? '').trim() !== '')
}

function dimensionOrOne(value: string | undefined): number {
  const text = String(value ?? '').trim()
  if (!text) return 1
  const n = toQty(text)
  return Number.isFinite(n) && n > 0 ? n : 1
}

export function quantityFromMeasurements(
  measurements: BoqMeasurements | null | undefined,
  fallback: number | string,
): number {
  if (!hasMeasurementValues(measurements)) return toQty(fallback)
  const qty =
    dimensionOrOne(measurements?.nos) *
    dimensionOrOne(measurements?.length) *
    dimensionOrOne(measurements?.breadth) *
    dimensionOrOne(measurements?.height)
  return Math.round(qty * 10000) / 10000
}

export function formatMeasurementsHint(value: BoqMeasurements | null | undefined): string {
  if (!hasMeasurementValues(value) || !value) return ''
  const parts: string[] = []
  const nos = String(value.nos ?? '').trim()
  const length = String(value.length ?? '').trim()
  const breadth = String(value.breadth ?? '').trim()
  const height = String(value.height ?? '').trim()
  if (nos) parts.push(nos)
  if (length) parts.push(length)
  if (breadth) parts.push(breadth)
  if (height) parts.push(height)
  return parts.join(' × ')
}

export function isChildRow<T extends { kind?: unknown; nested?: boolean; section?: string }>(
  items: T[],
  index: number,
): boolean {
  return parentHeadingIndex(items, index) >= 0
}

export function headingOwnsUntil<T extends { kind?: unknown; nested?: boolean; section?: string }>(
  items: T[],
  headingIndex: number,
): number {
  const heading = items[headingIndex]
  if (!heading || !isHeading(heading)) return headingIndex
  let end = headingIndex
  for (let i = headingIndex + 1; i < items.length; i++) {
    const row = items[i]
    if (!row) break
    if (heading.section && row.section && row.section !== heading.section) break
    if (isHeading(row)) break
    if (!row.nested) break
    end = i
  }
  return end
}

export function parentHeadingIndex<T extends { kind?: unknown; nested?: boolean; section?: string }>(
  items: T[],
  index: number,
): number {
  const current = items[index]
  if (!current || isHeading(current) || !current.nested) return -1
  for (let i = index - 1; i >= 0; i--) {
    const row = items[i]
    if (!row) continue
    if (current.section && row.section && row.section !== current.section) return -1
    if (isHeading(row)) return i
    if (!row.nested) return -1
  }
  return -1
}

export function blockRange<T extends { kind?: unknown; section?: string }>(
  items: T[],
  index: number,
): { start: number; end: number } {
  if (isHeading(items[index] ?? {})) {
    return { start: index, end: headingOwnsUntil(items, index) }
  }
  return { start: index, end: index }
}

export function previousBlockStart<T extends { kind?: unknown; section?: string }>(
  items: T[],
  start: number,
): number {
  if (start <= 0) return -1
  const current = items[start]
  const prev = items[start - 1]
  if (!current || !prev) return -1
  if (current.section && prev.section && prev.section !== current.section) return -1
  if (isHeading(prev)) return start - 1
  const parent = parentHeadingIndex(items, start - 1)
  return parent >= 0 ? parent : start - 1
}

export function nextBlockStart<T extends { kind?: unknown; section?: string }>(
  items: T[],
  end: number,
): number {
  const next = end + 1
  if (next >= items.length) return -1
  const current = items[end]
  const following = items[next]
  if (!current || !following) return -1
  if (current.section && following.section && following.section !== current.section) return -1
  return next
}

export function moveItemBlock<T extends { kind?: unknown; section?: string }>(
  items: T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const item = items[index]
  if (!item) return items
  if (isHeading(item)) {
    const { start, end } = blockRange(items, index)
    const block = items.slice(start, end + 1)
    if (direction < 0) {
      const dest = previousBlockStart(items, start)
      if (dest < 0) return items
      const before = items.slice(0, dest)
      const between = items.slice(dest, start)
      const after = items.slice(end + 1)
      return [...before, ...block, ...between, ...after]
    }
    const dest = nextBlockStart(items, end)
    if (dest < 0) return items
    const { start: nextStart, end: nextEnd } = blockRange(items, dest)
    const before = items.slice(0, start)
    const nextBlock = items.slice(nextStart, nextEnd + 1)
    const after = items.slice(nextEnd + 1)
    return [...before, ...nextBlock, ...block, ...after]
  }

  if (isChildRow(items, index)) {
    const parent = parentHeadingIndex(items, index)
    const groupEnd = headingOwnsUntil(items, parent)
    const target = index + direction
    if (target <= parent || target > groupEnd) return items
    const next = [...items]
    const current = next[index]
    const swap = next[target]
    if (!current || !swap) return items
    next[index] = swap
    next[target] = current
    return next
  }

  const { start, end } = blockRange(items, index)
  if (direction < 0) {
    const dest = previousBlockStart(items, start)
    if (dest < 0) return items
    const block = items.slice(start, end + 1)
    const before = items.slice(0, dest)
    const between = items.slice(dest, start)
    const after = items.slice(end + 1)
    return [...before, ...block, ...between, ...after]
  }
  const dest = nextBlockStart(items, end)
  if (dest < 0) return items
  const { start: nextStart, end: nextEnd } = blockRange(items, dest)
  const block = items.slice(start, end + 1)
  const before = items.slice(0, start)
  const nextBlock = items.slice(nextStart, nextEnd + 1)
  const after = items.slice(nextEnd + 1)
  return [...before, ...nextBlock, ...block, ...after]
}

export function boqSerialLabel<T extends { kind?: unknown; section?: string }>(
  items: T[],
  index: number,
  section: string,
): string {
  let group = 0
  let child = 0
  for (let i = 0; i <= index; i++) {
    const row = items[i]
    if (!row || row.section !== section) continue
    if (isHeading(row)) {
      group += 1
      child = 0
      if (i === index) return String(group)
      continue
    }
    if (isChildRow(items, i)) {
      child += 1
      if (i === index) return `${group}.${child}`
      continue
    }
    group += 1
    child = 0
    if (i === index) return String(group)
  }
  return ''
}
