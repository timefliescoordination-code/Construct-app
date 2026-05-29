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

export function validateSplitLines(
  totalAmount: number,
  lines: SplitLineInput[],
): { ok: true } | { ok: false; error: string } {
  if (lines.length === 0) {
    return { ok: false, error: 'Add at least one split payment.' }
  }
  if (lines.length > MAX_EXPENSE_SPLITS) {
    return { ok: false, error: `Maximum ${MAX_EXPENSE_SPLITS} splits allowed.` }
  }

  for (let i = 0; i < lines.length; i++) {
    const amount = parseSplitAmount(lines[i].amount)
    if (Number.isNaN(amount) || amount <= 0) {
      return { ok: false, error: `Split ${i + 1}: enter a valid amount.` }
    }
    if (!lines[i].date) {
      return { ok: false, error: `Split ${i + 1}: date is required.` }
    }
  }

  const sum = sumSplitAmounts(lines)
  if (Math.abs(sum - totalAmount) > 0.01) {
    return {
      ok: false,
      error: `Split amounts (₹${sum.toLocaleString()}) must equal total (₹${totalAmount.toLocaleString()}).`,
    }
  }

  return { ok: true }
}
