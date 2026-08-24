import type { ExportExpenseRow } from '@/lib/expense/export/types'
import { formatINR } from '../../currency.ts'

export const EXPORT_COLUMN_HEADERS = [
  'S.No.',
  'Expense ID',
  'Reference / Bill No.',
  'Expense Date',
  'Created Date',
  'Expense Type',
  'Project Name',
  'Category',
  'Subcategory',
  'Description',
  'Vendor / Payee',
  'Payment Method',
  'Payment Status',
  'Amount (INR)',
  'Tax / GST',
  'Total Amount (INR)',
  'Notes',
  'Created By',
  'Entered By',
  'Submitted By',
  'Approved By',
  'Milestone',
  'Labour Team',
  'Split Group ID',
  'Split No.',
  'Invoice File',
  'Invoice Number',
  'Invoice Total (INR)',
  'Updated At',
] as const

export function exportRowToCells(row: ExportExpenseRow): string[] {
  return [
    String(row.serialNumber),
    row.expenseId,
    row.referenceNumber ?? '',
    row.expenseDate,
    row.createdDate,
    row.expenseType,
    row.projectName ?? '',
    row.category,
    row.subcategory ?? '',
    row.description,
    row.vendorPayee ?? '',
    row.paymentMethod ?? '',
    row.paymentStatus ?? '',
    formatINR(row.amount),
    row.taxGst != null ? formatINR(row.taxGst) : '',
    formatINR(row.totalAmount),
    row.notes ?? '',
    row.createdBy ?? '',
    row.enteredBy ?? '',
    row.submittedBy ?? '',
    row.approvedBy ?? '',
    row.milestoneName ?? '',
    row.labourTeamName ?? '',
    row.splitGroupId ?? '',
    row.splitNumber != null ? String(row.splitNumber) : '',
    row.invoiceFileName ?? '',
    row.invoiceNumber ?? '',
    row.invoiceTotal != null ? formatINR(row.invoiceTotal) : '',
    row.updatedAt ?? '',
  ]
}

export function sumExportAmounts(rows: ExportExpenseRow[]): number {
  return rows.reduce((sum, row) => sum + row.totalAmount, 0)
}
