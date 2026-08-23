export type CostingRowPrice = { price: number | string }

/** Sum costing row prices for a change-request estimate total. */
export function sumCostingRows(rows: CostingRowPrice[]): number {
  return rows.reduce((sum, row) => sum + Number(row.price || 0), 0)
}

const PENDING_CHANGE_STATUSES = [
  'submitted',
  'under_review',
  'costing_prepared',
  'internal_approval_pending',
  'customer_approval_pending',
] as const

const APPROVED_CHANGE_STATUSES = [
  'approved',
  'scheduled',
  'in_progress',
  'completed',
] as const

export type ChangeRequestSummaryRow = {
  status: string
  estimated_additional_days: number | null
  active_costing_revision?: { total_price: number | string | null } | null
}

export function summarizeChangeRequestFinancials(rows: ChangeRequestSummaryRow[]) {
  let pendingValue = 0
  let approvedChangeValue = 0
  let pendingScheduleDays = 0
  let approvedScheduleDays = 0
  const byStatus: Record<string, number> = {}

  for (const row of rows) {
    byStatus[row.status] = (byStatus[row.status] ?? 0) + 1
    const price = Number(row.active_costing_revision?.total_price ?? 0)
    const days = Number(row.estimated_additional_days ?? 0)

    if (PENDING_CHANGE_STATUSES.includes(row.status as typeof PENDING_CHANGE_STATUSES[number])) {
      if (price > 0) pendingValue += price
      if (days > 0) pendingScheduleDays += days
    }
    if (APPROVED_CHANGE_STATUSES.includes(row.status as typeof APPROVED_CHANGE_STATUSES[number])) {
      if (price > 0) approvedChangeValue += price
      if (days > 0) approvedScheduleDays += days
    }
  }

  return {
    pendingValue,
    approvedChangeValue,
    pendingScheduleDays,
    approvedScheduleDays,
    byStatus,
  }
}
