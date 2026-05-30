import type {
  AllocationStatus,
  ApprovedExpenseInput,
  CashFlowLedgerFilters,
  CashFlowLedgerRow,
  CashFlowLedgerSummary,
  LedgerCategoryGroup,
  LedgerProjectGroup,
  LedgerAllocationLine,
  ReceivedPaymentInput,
} from "@/lib/cash-flow-ledger/types"

function compareDates(a: string, b: string): number {
  return new Date(a).getTime() - new Date(b).getTime()
}

function paymentSortDate(payment: ReceivedPaymentInput): string {
  return payment.receivedDate ?? payment.createdAt
}

export function getAllocationStatus(
  allocated: number,
  total: number,
): AllocationStatus {
  if (total <= 0) return "unallocated"
  if (allocated >= total - 0.01) return "fully_allocated"
  if (allocated > 0) return "partially_allocated"
  return "unallocated"
}

function groupLinesByProjectAndCategory(
  lines: LedgerAllocationLine[],
): LedgerProjectGroup[] {
  const byProject = new Map<string, LedgerAllocationLine[]>()
  for (const line of lines) {
    const current = byProject.get(line.projectId) ?? []
    current.push(line)
    byProject.set(line.projectId, current)
  }

  const groups: LedgerProjectGroup[] = []
  for (const [projectId, projectLines] of byProject) {
    const byCategory = new Map<string, LedgerAllocationLine[]>()
    for (const line of projectLines) {
      const current = byCategory.get(line.category) ?? []
      current.push(line)
      byCategory.set(line.category, current)
    }

    const categories: LedgerCategoryGroup[] = []
    for (const [category, items] of byCategory) {
      categories.push({
        category,
        amount: items.reduce((sum, item) => sum + item.amount, 0),
        items,
      })
    }

    categories.sort((a, b) => b.amount - a.amount)

    groups.push({
      projectId,
      projectName: projectLines[0]?.projectName ?? "Unknown project",
      totalAllocated: projectLines.reduce((sum, line) => sum + line.amount, 0),
      categories,
    })
  }

  groups.sort((a, b) => b.totalAllocated - a.totalAllocated)
  return groups
}

/** FIFO allocation: expenses consume oldest received payments first (per project). */
export function allocateProjectFunds(
  payments: ReceivedPaymentInput[],
  expenses: ApprovedExpenseInput[],
): Map<
  string,
  {
    allocated: number
    balance: number
    lines: LedgerAllocationLine[]
    projectGroups: LedgerProjectGroup[]
  }
> {
  const sortedPayments = [...payments].sort((a, b) =>
    compareDates(paymentSortDate(a), paymentSortDate(b)),
  )
  const sortedExpenses = [...expenses].sort((a, b) =>
    compareDates(a.expenseDate, b.expenseDate),
  )

  const balances = new Map<string, number>()
  const result = new Map<
    string,
    {
      allocated: number
      balance: number
      lines: LedgerAllocationLine[]
      projectGroups: LedgerProjectGroup[]
    }
  >()

  for (const payment of sortedPayments) {
    balances.set(payment.id, payment.amount)
    result.set(payment.id, {
      allocated: 0,
      balance: payment.amount,
      lines: [],
      projectGroups: [],
    })
  }

  for (const expense of sortedExpenses) {
    let remaining = expense.amount

    for (const payment of sortedPayments) {
      if (payment.projectId !== expense.projectId) continue
      if (remaining <= 0) break

      const balance = balances.get(payment.id) ?? 0
      if (balance <= 0) continue

      const alloc = Math.min(remaining, balance)
      balances.set(payment.id, balance - alloc)

      const entry = result.get(payment.id)!
      entry.allocated += alloc
      entry.balance -= alloc
      entry.lines.push({
        expenseId: expense.id,
        projectId: expense.projectId,
        projectName: expense.projectName,
        category: expense.category,
        description: expense.description,
        amount: alloc,
        expenseDate: expense.expenseDate,
      })

      remaining -= alloc
    }
  }

  for (const entry of result.values()) {
    entry.projectGroups = groupLinesByProjectAndCategory(entry.lines)
  }

  return result
}

function matchesFilters(
  row: CashFlowLedgerRow,
  filters: CashFlowLedgerFilters,
): boolean {
  if (filters.dateFrom && row.receivedDate < filters.dateFrom) return false
  if (filters.dateTo && row.receivedDate > filters.dateTo) return false
  if (
    filters.client &&
    !row.clientName.toLowerCase().includes(filters.client.toLowerCase())
  ) {
    return false
  }
  if (filters.projectId && row.projectId !== filters.projectId) return false
  if (filters.minAmount != null && row.amountReceived < filters.minAmount) {
    return false
  }
  if (filters.maxAmount != null && row.amountReceived > filters.maxAmount) {
    return false
  }
  if (
    filters.allocationStatus &&
    filters.allocationStatus !== "all" &&
    row.status !== filters.allocationStatus
  ) {
    return false
  }
  return true
}

export function buildCashFlowLedger(
  payments: ReceivedPaymentInput[],
  expenses: ApprovedExpenseInput[],
  filters: CashFlowLedgerFilters,
  offset: number,
  limit: number,
): {
  summary: CashFlowLedgerSummary
  rows: CashFlowLedgerRow[]
  total: number
  hasMore: boolean
} {
  const byProject = new Map<string, ReceivedPaymentInput[]>()
  for (const payment of payments) {
    const list = byProject.get(payment.projectId) ?? []
    list.push(payment)
    byProject.set(payment.projectId, list)
  }

  const expensesByProject = new Map<string, ApprovedExpenseInput[]>()
  for (const expense of expenses) {
    const list = expensesByProject.get(expense.projectId) ?? []
    list.push(expense)
    expensesByProject.set(expense.projectId, list)
  }

  const allocationByPayment = new Map<
    string,
    {
      allocated: number
      balance: number
      lines: LedgerAllocationLine[]
      projectGroups: LedgerProjectGroup[]
    }
  >()

  for (const [projectId, projectPayments] of byProject) {
    const projectExpenses = expensesByProject.get(projectId) ?? []
    const projectAllocations = allocateProjectFunds(
      projectPayments,
      projectExpenses,
    )
    for (const [paymentId, allocation] of projectAllocations) {
      allocationByPayment.set(paymentId, allocation)
    }
  }

  const allRows: CashFlowLedgerRow[] = payments.map((payment) => {
    const allocation = allocationByPayment.get(payment.id) ?? {
      allocated: 0,
      balance: payment.amount,
      lines: [],
      projectGroups: [],
    }
    const receivedDate = payment.receivedDate ?? payment.createdAt.slice(0, 10)

    return {
      paymentId: payment.id,
      clientName: payment.clientName,
      projectId: payment.projectId,
      projectName: payment.projectName,
      amountReceived: payment.amount,
      receivedDate,
      stageName: payment.stageName,
      allocated: allocation.allocated,
      balance: allocation.balance,
      allocationPercent:
        payment.amount > 0
          ? Math.min(100, Math.round((allocation.allocated / payment.amount) * 100))
          : 0,
      status: getAllocationStatus(allocation.allocated, payment.amount),
      projectGroups: allocation.projectGroups,
    }
  })

  allRows.sort((a, b) => compareDates(b.receivedDate, a.receivedDate))

  const filteredRows = allRows.filter((row) => matchesFilters(row, filters))

  const totalReceived = filteredRows.reduce(
    (sum, row) => sum + row.amountReceived,
    0,
  )
  const totalAllocated = filteredRows.reduce(
    (sum, row) => sum + row.allocated,
    0,
  )
  const unallocatedBalance = filteredRows.reduce(
    (sum, row) => sum + row.balance,
    0,
  )

  const summary: CashFlowLedgerSummary = {
    totalReceived,
    totalAllocated,
    unallocatedBalance,
    allocationEfficiency:
      totalReceived > 0
        ? Math.round((totalAllocated / totalReceived) * 100)
        : 0,
  }

  const page = filteredRows.slice(offset, offset + limit)

  return {
    summary,
    rows: page,
    total: filteredRows.length,
    hasMore: offset + limit < filteredRows.length,
  }
}
