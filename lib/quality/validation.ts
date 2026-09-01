export type QualitySelectOption = {
  value: string
  label: string
  result?: 'pass' | 'fail'
}

type QualityItemStatus = 'pass' | 'fail' | 'na' | 'not_checked'
type QualityParameterType =
  | 'numeric'
  | 'ratio'
  | 'text'
  | 'single_select'
  | 'multi_select'
  | 'boolean'
  | 'measurement'

export type ParameterValidationInput = {
  parameter_type: QualityParameterType
  actual_value: string | null | undefined
  expected_value?: string | null
  min_value?: number | null
  max_value?: number | null
  options?: QualitySelectOption[] | null
}

function trim(value: string | null | undefined): string {
  return String(value ?? '').trim()
}

export function parseRatio(value: string): { parts: number[] } | null {
  const cleaned = trim(value).replace(/\s+/g, '')
  if (!cleaned) return null
  const parts = cleaned.split(':').map((part) => Number(part))
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n) || n < 0)) return null
  return { parts }
}

export function ratiosEqual(a: string, b: string): boolean {
  const left = parseRatio(a)
  const right = parseRatio(b)
  if (!left || !right || left.parts.length !== right.parts.length) return false
  return left.parts.every((n, i) => Math.abs(n - right.parts[i]) < 1e-9)
}

export function parseNumericActual(value: string): number | null {
  const cleaned = trim(value).replace(/,/g, '')
  if (!cleaned) return null
  const match = cleaned.match(/-?\d+(?:\.\d+)?/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) ? n : null
}

function parseBooleanToken(value: string): boolean | null {
  const v = trim(value).toLowerCase()
  if (['yes', 'true', '1', 'y'].includes(v)) return true
  if (['no', 'false', '0', 'n'].includes(v)) return false
  return null
}

function parseMultiActual(value: string): string[] {
  const raw = trim(value)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean)
    }
  } catch {
    // comma-separated fallback
  }
  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function evaluateParameterStatus(
  input: ParameterValidationInput,
): QualityItemStatus | null {
  const actual = trim(input.actual_value)
  if (!actual) return null

  switch (input.parameter_type) {
    case 'numeric':
    case 'measurement': {
      const n = parseNumericActual(actual)
      if (n === null) return null
      if (input.min_value != null && n < Number(input.min_value)) return 'fail'
      if (input.max_value != null && n > Number(input.max_value)) return 'fail'
      if (input.min_value != null || input.max_value != null) return 'pass'
      if (input.expected_value) {
        const expected = parseNumericActual(input.expected_value)
        if (expected == null) return null
        return Math.abs(n - expected) < 1e-6 ? 'pass' : 'fail'
      }
      return null
    }
    case 'ratio': {
      if (!input.expected_value) return null
      return ratiosEqual(actual, input.expected_value) ? 'pass' : 'fail'
    }
    case 'text': {
      if (!input.expected_value) return null
      return actual.toLowerCase() === trim(input.expected_value).toLowerCase() ? 'pass' : 'fail'
    }
    case 'boolean': {
      const actualBool = parseBooleanToken(actual)
      if (actualBool == null) return null
      const expectedBool = input.expected_value
        ? parseBooleanToken(input.expected_value)
        : true
      if (expectedBool == null) return actualBool ? 'pass' : 'fail'
      return actualBool === expectedBool ? 'pass' : 'fail'
    }
    case 'single_select': {
      const option = (input.options ?? []).find(
        (row) => row.value === actual || row.label === actual,
      )
      if (option?.result === 'pass' || option?.result === 'fail') return option.result
      if (input.expected_value) {
        return actual === trim(input.expected_value) ? 'pass' : 'fail'
      }
      return null
    }
    case 'multi_select': {
      const selected = parseMultiActual(actual)
      if (selected.length === 0) return null
      const expected = input.expected_value
        ? parseMultiActual(input.expected_value)
        : []
      if (expected.length > 0) {
        const selectedSet = new Set(selected)
        return expected.every((item) => selectedSet.has(item)) ? 'pass' : 'fail'
      }
      const failing = selected.some((value) => {
        const option = (input.options ?? []).find(
          (row) => row.value === value || row.label === value,
        )
        return option?.result === 'fail'
      })
      if (failing) return 'fail'
      const allHaveResult = selected.every((value) => {
        const option = (input.options ?? []).find(
          (row) => row.value === value || row.label === value,
        )
        return option?.result === 'pass' || option?.result === 'fail'
      })
      if (allHaveResult) return 'pass'
      return null
    }
    default:
      return null
  }
}

export function formatRequirement(input: {
  requirement_label?: string | null
  expected_value?: string | null
  min_value?: number | null
  max_value?: number | null
  unit?: string | null
}): string {
  if (trim(input.requirement_label)) return trim(input.requirement_label)
  const unit = trim(input.unit)
  const unitSuffix = unit ? ` ${unit}` : ''
  if (input.min_value != null && input.max_value != null) {
    return `${input.min_value}–${input.max_value}${unitSuffix}`
  }
  if (input.min_value != null) return `Min ${input.min_value}${unitSuffix}`
  if (input.max_value != null) return `Max ${input.max_value}${unitSuffix}`
  if (trim(input.expected_value)) return `${trim(input.expected_value)}${unitSuffix}`
  return 'As per drawing / specification'
}
