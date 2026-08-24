import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExpenseExportSummary } from './types.ts'
import type { ExportExpenseRow } from './types.ts'
import { formatINR } from '../../currency.ts'

export type PdfExportInput = {
  rows: ExportExpenseRow[]
  filtersLabel: string
  companyName: string
  summary: ExpenseExportSummary
  exportedAt?: Date
}

const PDF_COLUMNS = [
  { header: 'Date (DD-MM-YYYY)', dataKey: 'expenseDate' },
  { header: 'Description', dataKey: 'description' },
  { header: 'Amount', dataKey: 'amount' },
] as const

function formatPdfDate(value: string): string {
  const isoDate = value.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return value
  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

export function buildExpensePdfBuffer(input: PdfExportInput): Buffer {
  const exportedAt = input.exportedAt ?? new Date()
  const totalAmount = input.rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })

  doc.setFontSize(16)
  doc.text('Expense Export Report', 40, 36)
  doc.setFontSize(10)
  doc.text(input.companyName, 40, 54)
  doc.text(input.filtersLabel, 40, 68, { maxWidth: 515 })
  doc.text(
    `Exported: ${format(exportedAt, 'dd MMM yyyy HH:mm')} · Records: ${input.rows.length}`,
    40,
    84,
    { maxWidth: 515 },
  )

  const body = input.rows.map((row) =>
    PDF_COLUMNS.map((col) => {
      if (col.dataKey === 'expenseDate') {
        return formatPdfDate(row.expenseDate)
      }
      if (col.dataKey === 'amount') {
        return formatINR(Number(row.amount ?? 0))
      }
      return row.description ?? ''
    }),
  )

  autoTable(doc, {
    startY: 96,
    head: [PDF_COLUMNS.map((col) => col.header)],
    body,
    foot: [['', 'Total Amount', formatINR(totalAmount)]],
    showFoot: 'lastPage',
    styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 64, 120], textColor: 255 },
    footStyles: { fillColor: [243, 244, 246], textColor: 20, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 110 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 110, halign: 'right' },
    },
    margin: { left: 40, right: 40 },
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

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

export function getFullPdfColumnHeaders(): readonly string[] {
  return PDF_COLUMNS.map((col) => col.header)
}
