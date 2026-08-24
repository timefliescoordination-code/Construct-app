import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExpenseExportSummary } from './types.ts'
import type { ExportExpenseRow } from './types.ts'
import { EXPORT_COLUMN_HEADERS, sumExportAmounts } from './columns.ts'
import { formatINR } from '../../currency.ts'

export type PdfExportInput = {
  rows: ExportExpenseRow[]
  filtersLabel: string
  companyName: string
  summary: ExpenseExportSummary
  exportedAt?: Date
}

const PDF_COLUMNS = [
  { header: 'S.No.', dataKey: 'serialNumber' },
  { header: 'Date', dataKey: 'expenseDate' },
  { header: 'Type', dataKey: 'expenseType' },
  { header: 'Project', dataKey: 'projectName' },
  { header: 'Category', dataKey: 'category' },
  { header: 'Subcategory', dataKey: 'subcategory' },
  { header: 'Description', dataKey: 'description' },
  { header: 'Vendor', dataKey: 'vendorPayee' },
  { header: 'Status', dataKey: 'paymentStatus' },
  { header: 'Amount', dataKey: 'amount' },
  { header: 'Total', dataKey: 'totalAmount' },
  { header: 'Created By', dataKey: 'createdBy' },
  { header: 'Invoice', dataKey: 'invoiceFileName' },
] as const

export function buildExpensePdfBuffer(input: PdfExportInput): Buffer {
  const exportedAt = input.exportedAt ?? new Date()
  const totalAmount = sumExportAmounts(input.rows)
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })

  doc.setFontSize(16)
  doc.text('Expense Export Report', 40, 36)
  doc.setFontSize(10)
  doc.text(input.companyName, 40, 54)
  doc.text(input.filtersLabel, 40, 68, { maxWidth: 760 })
  doc.text(
    `Exported: ${format(exportedAt, 'dd MMM yyyy HH:mm')} · Records: ${input.rows.length} · Total: ${formatINR(totalAmount)}`,
    40,
    84,
    { maxWidth: 760 },
  )

  const body = input.rows.map((row) =>
    PDF_COLUMNS.map((col) => {
      const value = row[col.dataKey as keyof ExportExpenseRow]
      if (col.dataKey === 'amount' || col.dataKey === 'totalAmount') {
        return formatINR(Number(value ?? 0))
      }
      if (value == null) return ''
      return String(value)
    }),
  )

  autoTable(doc, {
    startY: 96,
    head: [PDF_COLUMNS.map((col) => col.header)],
    body,
    styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 120], textColor: 255 },
    margin: { left: 24, right: 24 },
    showHead: 'everyPage',
    didDrawPage: (data) => {
      const pageCount = doc.getNumberOfPages()
      doc.setFontSize(8)
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        doc.internal.pageSize.getWidth() - 90,
        doc.internal.pageSize.getHeight() - 16,
      )
    },
  })

  let summaryY =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 120) + 24

  doc.setFontSize(12)
  doc.text('Summary by Project', 40, summaryY)
  summaryY += 14

  autoTable(doc, {
    startY: summaryY,
    head: [['Project', 'Records', 'Total (INR)']],
    body: input.summary.byProject.map((row) => [
      row.projectName,
      String(row.count),
      formatINR(row.total),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [55, 65, 81] },
    margin: { left: 40, right: 40 },
  })

  summaryY =
    ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? summaryY) + 20

  doc.setFontSize(12)
  doc.text('Summary by Category', 40, summaryY)
  summaryY += 14

  autoTable(doc, {
    startY: summaryY,
    head: [['Category', 'Records', 'Total (INR)']],
    body: input.summary.byCategory.map((row) => [
      row.category,
      String(row.count),
      formatINR(row.total),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [55, 65, 81] },
    margin: { left: 40, right: 40 },
  })

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

export function getFullPdfColumnHeaders(): readonly string[] {
  return EXPORT_COLUMN_HEADERS
}
