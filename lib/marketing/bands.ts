import { DURATION_BANDS, SIZE_BANDS, type CostBand, type DurationBand, type SizeBand } from './types.ts'

const CRORE = 10_000_000

function asFiniteNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export function sizeBandFromSqft(sqft: number | string | null | undefined): SizeBand | undefined {
  const value = asFiniteNumber(sqft)
  if (value == null) return undefined
  if (value < 1500) return SIZE_BANDS[0]
  if (value < 2500) return SIZE_BANDS[1]
  if (value < 4000) return SIZE_BANDS[2]
  return SIZE_BANDS[3]
}

/** Round rupees to one decimal Crore, e.g. 12,300,000 → "1.2 Cr residence". */
export function formatCroreResidence(amount: number): string {
  const rounded = Math.round((amount / CRORE) * 10) / 10
  if (rounded < 0.1) return 'Under 0.1 Cr residence'
  if (Number.isInteger(rounded)) return `${rounded} Cr residence`
  return `${rounded.toFixed(1)} Cr residence`
}

export function costBandFromRupees(
  amount: number | string | null | undefined,
): CostBand | undefined {
  const value = asFiniteNumber(amount)
  if (value == null) return undefined
  return formatCroreResidence(value)
}

function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null
  return new Date(Date.UTC(year, month - 1, day))
}

/** Whole months from start to end, counting a partial month only when the end day has been reached. */
export function monthsBetweenDates(startDate: string, endDate: string): number | null {
  const start = parseIsoDate(startDate)
  const end = parseIsoDate(endDate)
  if (!start || !end || end <= start) return null
  let months =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth())
  if (end.getUTCDate() < start.getUTCDate()) months -= 1
  if (months < 0) return null
  return months
}

export function durationBandFromDates(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): DurationBand | undefined {
  if (!startDate || !endDate) return undefined
  const months = monthsBetweenDates(startDate, endDate)
  if (months == null) return undefined
  if (months < 12) return DURATION_BANDS[0]
  if (months < 18) return DURATION_BANDS[1]
  if (months < 24) return DURATION_BANDS[2]
  return DURATION_BANDS[3]
}

export function bandCombinationKey(bands: {
  size?: string
  cost?: string
  duration?: string
}): string {
  return `${bands.size ?? ''}|${bands.cost ?? ''}|${bands.duration ?? ''}`
}
