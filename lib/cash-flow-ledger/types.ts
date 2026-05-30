export type AllocationStatus =
  | "fully_allocated"
  | "partially_allocated"
  | "unallocated"

export type LedgerAllocationLine = {
  expenseId: string
  projectId: string
  projectName: string
  category: string
  description: string
  amount: number
  expenseDate: string
}

export type LedgerCategoryGroup = {
  category: string
  amount: number
  items: LedgerAllocationLine[]
}

export type LedgerProjectGroup = {
  projectId: string
  projectName: string
  totalAllocated: number
  categories: LedgerCategoryGroup[]
}

export type CashFlowLedgerRow = {
  paymentId: string
  clientName: string
  projectId: string
  projectName: string
  amountReceived: number
  receivedDate: string
  stageName: string
  allocated: number
  balance: number
  allocationPercent: number
  status: AllocationStatus
  projectGroups: LedgerProjectGroup[]
}

export type CashFlowLedgerSummary = {
  totalReceived: number
  totalAllocated: number
  unallocatedBalance: number
  allocationEfficiency: number
}

export type CashFlowLedgerFilters = {
  dateFrom?: string
  dateTo?: string
  client?: string
  projectId?: string
  minAmount?: number
  maxAmount?: number
  allocationStatus?: AllocationStatus | "all"
}

export type CashFlowLedgerResponse = {
  summary: CashFlowLedgerSummary
  rows: CashFlowLedgerRow[]
  total: number
  offset: number
  limit: number
  hasMore: boolean
  filterOptions: {
    clients: string[]
    projects: { id: string; name: string }[]
  }
}

export type ReceivedPaymentInput = {
  id: string
  projectId: string
  projectName: string
  clientName: string
  amount: number
  receivedDate: string | null
  createdAt: string
  stageName: string
}

export type ApprovedExpenseInput = {
  id: string
  projectId: string
  projectName: string
  category: string
  description: string
  amount: number
  expenseDate: string
}
