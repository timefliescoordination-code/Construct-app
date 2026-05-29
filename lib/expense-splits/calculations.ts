export const MAX_EXPENSE_SPLITS = 10

export type SplitPaymentDisplayStatus =
  | 'Pending payment'
  | 'Partially paid'
  | 'Fully paid'

export type SplitLineInput = {
  id?: string
  amount: string
  date: string
  /** Existing rows from DB cannot edit amount/date */
  locked?: boolean
}

export function parseSplitAmount(value: string): number {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : NaN
}

export function sumSplitAmounts(lines: { amount: string }[]): number {
  return lines.reduce((sum, line) => {
    const n = parseSplitAmount(line.amount)
    return sum + (Number.isNaN(n) ? 0 : n)
  }, 0)
}

export function sumRecordedSplitAmounts(
  splits: { amount: number }[],
): number {
  return splits.reduce((sum, s) => sum + Number(s.amount), 0)
}

export function getRemainingRecordedBalance(
  totalAmount: number,
  splits: { amount: number }[],
): number {
  return Math.max(0, totalAmount - sumRecordedSplitAmounts(splits))
}

export function isGroupFullyRecorded(
  totalAmount: number,
  splits: { amount: number }[],
): boolean {
  return sumRecordedSplitAmounts(splits) >= totalAmount - 0.01
}

export function getSplitPaymentStatus(
  totalAmount: number,
  splits: { amount: number; status: string }[],
): SplitPaymentDisplayStatus {
  const approvedSum = splits
    .filter((s) => s.status === 'approved')
    .reduce((sum, s) => sum + Number(s.amount), 0)

  if (totalAmount > 0 && approvedSum >= totalAmount - 0.01) {
    return 'Fully paid'
  }
  if (approvedSum > 0) {
    return 'Partially paid'
  }
  return 'Pending payment'
}

export function normalizeMatchText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function buildExpenseGroupMatchKey(input: {
  category: string
  description: string
  vendorName: string | null
  labourTeamId: string | null
  subcategoryName: string | null
}): string {
  return [
    normalizeMatchText(input.category),
    normalizeMatchText(input.labourTeamId ?? input.subcategoryName),
    normalizeMatchText(input.vendorName),
    normalizeMatchText(input.description),
  ].join('|')
}

/** Match open split suggestions by category + labour team or subcategory only. */
export function buildExpenseCategoryMatchKey(input: {
  category: string
  labourTeamId: string | null
  subcategoryName: string | null
}): string {
  return [
    normalizeMatchText(input.category),
    normalizeMatchText(input.labourTeamId ?? input.subcategoryName),
  ].join('|')
}

export type LabourTeamRef = { id: string; name: string }

/** Text before " - " in stored expense descriptions (team name or subcategory). */
export function parseLeadingLabelFromDescription(description: string): string {
  const separator = ' - '
  const idx = description.indexOf(separator)
  if (idx === -1) return ''
  return description.slice(0, idx).trim()
}

function normalizeLabourMatchSegment(
  teamIdOrName: string,
  labourTeams: LabourTeamRef[],
): string {
  const byId = labourTeams.find((t) => t.id === teamIdOrName)
  if (byId) return normalizeMatchText(byId.id)
  const byName = labourTeams.find(
    (t) => normalizeMatchText(t.name) === normalizeMatchText(teamIdOrName),
  )
  if (byName) return normalizeMatchText(byName.id)
  return normalizeMatchText(teamIdOrName)
}

function resolveLabourTeamId(
  labourTeamId: string | null | undefined,
  groupLabourTeamId: string | null | undefined,
  description: string,
  labourTeams: LabourTeamRef[],
): string | null {
  if (labourTeamId) return labourTeamId
  if (groupLabourTeamId) return groupLabourTeamId
  const teamName = parseLeadingLabelFromDescription(description)
  if (!teamName) return null
  const match = labourTeams.find(
    (t) => normalizeMatchText(t.name) === normalizeMatchText(teamName),
  )
  return match?.id ?? null
}

function resolveSubcategoryName(
  subcategoryName: string | null | undefined,
  groupSubcategoryName: string | null | undefined,
  description: string,
): string | null {
  const direct = subcategoryName?.trim() || groupSubcategoryName?.trim()
  if (direct) return direct
  const fromDescription = parseLeadingLabelFromDescription(description)
  return fromDescription || null
}

/**
 * Stable match key for split suggestions (category + labour team id or subcategory).
 */
export function resolveCategoryMatchKey(input: {
  category: string
  usesLabourTeams: boolean
  labourTeamId?: string | null
  subcategoryName?: string | null
  description?: string
  groupLabourTeamId?: string | null
  groupSubcategoryName?: string | null
  labourTeams?: LabourTeamRef[]
}): string | null {
  const category = normalizeMatchText(input.category)
  if (!category) return null

  const description = input.description ?? ''
  const labourTeams = input.labourTeams ?? []

  if (input.usesLabourTeams) {
    const teamId = resolveLabourTeamId(
      input.labourTeamId,
      input.groupLabourTeamId,
      description,
      labourTeams,
    )
    if (!teamId) return null
    return `${category}|${normalizeLabourMatchSegment(teamId, labourTeams)}`
  }

  const subcategory = resolveSubcategoryName(
    input.subcategoryName,
    input.groupSubcategoryName,
    description,
  )
  if (!subcategory) return null

  return buildExpenseCategoryMatchKey({
    category: input.category,
    labourTeamId: null,
    subcategoryName: subcategory,
  })
}

function validateSplitLineFields(
  lines: SplitLineInput[],
  labelOffset = 0,
): { ok: true } | { ok: false; error: string } {
  for (let i = 0; i < lines.length; i++) {
    const amount = parseSplitAmount(lines[i].amount)
    if (Number.isNaN(amount) || amount <= 0) {
      return {
        ok: false,
        error: `Split ${i + 1 + labelOffset}: enter a valid amount.`,
      }
    }
    if (!lines[i].date) {
      return {
        ok: false,
        error: `Split ${i + 1 + labelOffset}: date is required.`,
      }
    }
  }
  return { ok: true }
}

/** First record: at least one split; amounts may be less than total (finish later). */
export function validateInitialSplitCreate(
  totalAmount: number,
  lines: SplitLineInput[],
): { ok: true } | { ok: false; error: string } {
  if (totalAmount <= 0) {
    return { ok: false, error: 'Enter a valid total amount.' }
  }
  if (lines.length === 0) {
    return { ok: false, error: 'Enter the first payment amount for today.' }
  }
  if (lines.length > MAX_EXPENSE_SPLITS) {
    return { ok: false, error: `Maximum ${MAX_EXPENSE_SPLITS} splits allowed.` }
  }

  const fields = validateSplitLineFields(lines)
  if (!fields.ok) return fields

  const sum = sumSplitAmounts(lines)
  if (sum > totalAmount + 0.01) {
    return {
      ok: false,
      error: `First payment cannot exceed total (₹${totalAmount.toLocaleString()}).`,
    }
  }

  return { ok: true }
}

/** Adding more splits later: existing + new must not exceed total. */
export function validateAppendSplits(
  totalAmount: number,
  existingSplits: { amount: number }[],
  newLines: SplitLineInput[],
): { ok: true } | { ok: false; error: string } {
  if (newLines.length === 0) {
    return { ok: false, error: 'Enter the payment amount and date.' }
  }

  const totalCount = existingSplits.length + newLines.length
  if (totalCount > MAX_EXPENSE_SPLITS) {
    return { ok: false, error: `Maximum ${MAX_EXPENSE_SPLITS} splits allowed.` }
  }

  const fields = validateSplitLineFields(newLines, existingSplits.length)
  if (!fields.ok) return fields

  const existingSum = sumRecordedSplitAmounts(existingSplits)
  const newSum = sumSplitAmounts(newLines)
  if (existingSum + newSum > totalAmount + 0.01) {
    return {
      ok: false,
      error: `Total recorded (₹${(existingSum + newSum).toLocaleString()}) cannot exceed obligation (₹${totalAmount.toLocaleString()}). Remaining: ₹${getRemainingRecordedBalance(totalAmount, existingSplits).toLocaleString()}.`,
    }
  }

  return { ok: true }
}

/** @deprecated Use validateInitialSplitCreate or validateAppendSplits */
export function validateSplitLines(
  totalAmount: number,
  lines: SplitLineInput[],
): { ok: true } | { ok: false; error: string } {
  return validateInitialSplitCreate(totalAmount, lines)
}
