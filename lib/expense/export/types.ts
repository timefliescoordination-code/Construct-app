export type ExpenseExportType = 'project' | 'company' | 'personal'

export type ExpenseExportFilters = {
  allExpenses: boolean
  dateFrom?: string
  dateTo?: string
  projectId?: string
  category?: string
  subcategory?: string
  vendor?: string
  paymentStatus?: string
  expenseType?: ExpenseExportType | 'all'
  createdBy?: string
}

export type ExportExpenseRow = {
  serialNumber: number
  expenseId: string
  referenceNumber: string | null
  expenseDate: string
  createdDate: string
  expenseType: ExpenseExportType
  projectId: string | null
  projectName: string | null
  category: string
  subcategory: string | null
  description: string
  vendorPayee: string | null
  paymentMethod: string | null
  paymentStatus: string | null
  amount: number
  taxGst: number | null
  totalAmount: number
  notes: string | null
  createdBy: string | null
  enteredBy: string | null
  submittedBy: string | null
  approvedBy: string | null
  milestoneName: string | null
  labourTeamName: string | null
  billNumber: string | null
  splitGroupId: string | null
  splitNumber: number | null
  invoiceFileName: string | null
  invoiceNumber: string | null
  invoiceTotal: number | null
  updatedAt: string | null
}

export type ExpenseExportPreview = {
  count: number
  totalAmount: number
  filters: ExpenseExportFilters
  filtersLabel: string
}

export type ExpenseExportSummary = {
  byProject: Array<{ projectName: string; total: number; count: number }>
  byCategory: Array<{ category: string; total: number; count: number }>
}

export const EXPORT_PAGE_SIZE = 1000
export const EXPORT_MAX_ROWS = 50_000
