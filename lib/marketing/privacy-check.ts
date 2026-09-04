import { COST_BANDS, DURATION_BANDS, SIZE_BANDS, type PrivacyCheckResult } from './types.ts'

const ALLOWED_PHRASES = [...SIZE_BANDS, ...COST_BANDS, ...DURATION_BANDS, 'Based on an itemized BOQ']

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function stripAllowedPhrases(markdown: string): string {
  let next = markdown
  for (const phrase of ALLOWED_PHRASES) {
    next = next.split(phrase).join(' ')
  }
  return next
}

function indianGrouped(amount: number): string {
  const [whole, fraction] = Math.abs(amount).toFixed(2).split('.')
  const lastThree = whole.slice(-3)
  const rest = whole.slice(0, -3)
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree
  return fraction === '00' ? grouped : `${grouped}.${fraction}`
}

function westernGrouped(amount: number): string {
  return Math.abs(Math.round(amount)).toLocaleString('en-US')
}

export function numericSecretVariants(value: number | string | null | undefined): string[] {
  if (value == null || value === '') return []
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[,₹Rs.\s]/g, ''))
  if (!Number.isFinite(n) || n <= 0) {
    const raw = String(value).trim()
    return raw ? [raw] : []
  }
  const rounded = Math.round(n)
  return Array.from(
    new Set([
      String(rounded),
      westernGrouped(rounded),
      indianGrouped(rounded),
      indianGrouped(n),
    ]),
  ).filter((item) => item.replace(/[,\.]/g, '').length >= 4)
}

export function collectForbiddenTokens(fields: Array<string | null | undefined | number>): string[] {
  const tokens: string[] = []
  for (const field of fields) {
    if (field == null || field === '') continue
    if (typeof field === 'number') {
      tokens.push(...numericSecretVariants(field))
      continue
    }
    const trimmed = field.trim()
    const isContact = trimmed.includes('@') || /(?:\+91[\s-]*)?[6-9]\d{9}\b/.test(trimmed)
    if (!isContact && trimmed.length < 4) continue
    tokens.push(trimmed)
  }
  return Array.from(new Set(tokens))
}

function phraseFound(haystack: string, needle: string): boolean {
  const n = normalizeForSearch(needle)
  if (n.length < 3) return false
  return normalizeForSearch(haystack).includes(n)
}

type PatternRule = { id: string; pattern: RegExp; label: string }

const PATTERN_RULES: PatternRule[] = [
  { id: 'email', pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i, label: 'email address' },
  {
    id: 'phone-in',
    pattern: /(?:\+91[\s-]*)?[6-9]\d{9}\b/,
    label: 'phone number',
  },
  { id: 'phone-split', pattern: /\b[6-9]\d{4}[\s-]\d{5}\b/, label: 'phone number' },
  { id: 'year', pattern: /\b(?:19|20)\d{2}\b/, label: '4-digit year' },
  { id: 'vra-prefix', pattern: /VRA-/i, label: 'VRA- identifier' },
  { id: 'invoice', pattern: /\bINV[-_]\S+/i, label: 'invoice number' },
  { id: 'change-request-no', pattern: /\bCR[-_]\d+/i, label: 'change-request number' },
  { id: 'rupee-amount', pattern: /₹\s*[\d,]+(?:\.\d+)?/, label: 'exact rupee value' },
  { id: 'rs-amount', pattern: /\bRs\.?\s*[\d,]{4,}(?:\.\d+)?\b/i, label: 'exact rupee value' },
  {
    id: 'sqft-exact',
    pattern: /\b\d{1,3}(?:,\d{2,3})+|\d{4,}(?=\s*(?:sq\.?\s*ft|sqft|sft)\b)/i,
    label: 'exact sq.ft value',
  },
  {
    id: 'address',
    pattern: /\d+\s+\w[\w']*(?:\s+\w[\w']*){0,4}\s+(?:street|st\.|road|rd\.|nagar|layout|avenue|ave\.|lane|colony)\b/i,
    label: 'address-like string',
  },
  { id: 'address-word', pattern: /\b(?:pincode|pin code|gps|coordinates)\b/i, label: 'location identifier' },
  { id: 'pincode', pattern: /\b\d{6}\b/, label: 'pincode-like number' },
  { id: 'url', pattern: /https?:\/\/\S+/i, label: 'URL' },
  { id: 'storage-url', pattern: /storage\/v1\/object/i, label: 'file URL' },
  {
    id: 'file-name',
    pattern: /\b[\w.-]+\.(?:jpg|jpeg|png|webp|gif|pdf|dwg|xlsx|docx)\b/i,
    label: 'file name',
  },
  { id: 'boq-supply', pattern: /supply and install/i, label: 'BOQ-style line item' },
  { id: 'tmt', pattern: /\b\d+\s*mm\s+tmt\b/i, label: 'BOQ-style line item' },
]

export function checkMarkdownPrivacy(
  markdown: string,
  forbiddenTokens: string[] = [],
): PrivacyCheckResult {
  const issues: string[] = []
  const scanned = stripAllowedPhrases(markdown)

  for (const token of forbiddenTokens) {
    if (phraseFound(markdown, String(token))) {
      issues.push(`contains private value: ${String(token).slice(0, 80)}`)
    }
  }

  for (const rule of PATTERN_RULES) {
    if (rule.pattern.test(scanned)) {
      issues.push(`contains ${rule.label}`)
    }
  }

  return { ok: issues.length === 0, issues }
}
