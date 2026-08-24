import { format } from 'date-fns'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { ExpenseExportSummary } from './types.ts'
import type { ExportExpenseRow } from './types.ts'

export type PdfExportInput = {
  rows: ExportExpenseRow[]
  filtersLabel: string
  companyName: string
  summary: ExpenseExportSummary
  exportedAt?: Date
}

const MARGIN_X = 48
const PAGE_TOP = 36
const TABLE_TOP = 104
const INK: [number, number, number] = [28, 28, 28]
const MUTED: [number, number, number] = [112, 112, 112]
const RULE: [number, number, number] = [210, 210, 210]
const HAIRLINE: [number, number, number] = [150, 150, 150]
const ZEBRA: [number, number, number] = [248, 248, 248]

const PDF_COLUMNS = [
  { header: 'Date', dataKey: 'expenseDate' },
  { header: 'Description', dataKey: 'description' },
  { header: 'Amount (INR)', dataKey: 'amount' },
] as const

function formatPdfDate(value: string): string {
  const isoDate = value.slice(0, 10)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return value
  const [, year, month, day] = match
  return `${day}-${month}-${year}`
}

/** Helvetica cannot render ₹; use Indian grouping with ASCII only. */
function formatPdfAmount(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe)
}

export function buildExpensePdfBuffer(input: PdfExportInput): Buffer {
  const exportedAt = input.exportedAt ?? new Date()
  const totalAmount = input.rows.reduce((sum, row) => sum + Number(row.amount ?? 0), 0)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const contentWidth = pageWidth - MARGIN_X * 2

  const body = input.rows.map((row) => [
    formatPdfDate(row.expenseDate),
    row.description ?? '',
    formatPdfAmount(Number(row.amount ?? 0)),
  ])

  autoTable(doc, {
    startY: TABLE_TOP,
    head: [PDF_COLUMNS.map((col) => col.header)],
    body,
    foot: [['', 'Total', formatPdfAmount(totalAmount)]],
    showHead: 'everyPage',
    showFoot: 'lastPage',
    theme: 'plain',
    margin: { left: MARGIN_X, right: MARGIN_X, top: TABLE_TOP, bottom: 40 },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 7, right: 8, bottom: 7, left: 8 },
      overflow: 'linebreak',
      valign: 'middle',
      lineWidth: 0,
      minCellHeight: 22,
    },
    headStyles: {
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 8,
      textColor: MUTED,
      fillColor: false,
      cellPadding: { top: 4, right: 8, bottom: 8, left: 8 },
    },
    bodyStyles: {
      fillColor: false,
    },
    alternateRowStyles: {
      fillColor: ZEBRA,
    },
    footStyles: {
      font: 'helvetica',
      fontStyle: 'bold',
      fontSize: 9,
      textColor: INK,
      fillColor: false,
      cellPadding: { top: 10, right: 8, bottom: 8, left: 8 },
    },
    columnStyles: {
      0: { cellWidth: 86, textColor: MUTED },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 108, halign: 'right' },
    },
    didDrawCell: (data) => {
      const x = data.cell.x
      const y = data.cell.y
      const w = data.cell.width
      const h = data.cell.height
      if (data.section === 'head') {
        doc.setDrawColor(...HAIRLINE)
        doc.setLineWidth(0.6)
        doc.line(x, y + h, x + w, y + h)
      }
      if (data.section === 'foot') {
        doc.setDrawColor(...INK)
        doc.setLineWidth(0.5)
        doc.line(x, y, x + w, y)
      }
    },
  })

  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page)

    doc.setFillColor(255, 255, 255)
    doc.rect(0, 0, pageWidth, TABLE_TOP - 8, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(input.companyName.toUpperCase(), MARGIN_X, PAGE_TOP)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...INK)
    doc.text('Expense report', MARGIN_X, PAGE_TOP + 18)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    const meta = [
      format(exportedAt, 'dd MMM yyyy, HH:mm'),
      `${input.rows.length} record${input.rows.length === 1 ? '' : 's'}`,
      'Dates as DD-MM-YYYY',
    ].join('   ·   ')
    doc.text(meta, MARGIN_X, PAGE_TOP + 34, { maxWidth: contentWidth })

    if (input.filtersLabel) {
      doc.text(input.filtersLabel, MARGIN_X, PAGE_TOP + 48, { maxWidth: contentWidth })
    }

    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.4)
    doc.line(MARGIN_X, TABLE_TOP - 12, pageWidth - MARGIN_X, TABLE_TOP - 12)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...MUTED)
    doc.text(`Page ${page} of ${pageCount}`, pageWidth / 2, pageHeight - 22, { align: 'center' })
  }

  const arrayBuffer = doc.output('arraybuffer')
  return Buffer.from(arrayBuffer)
}

export function getFullPdfColumnHeaders(): readonly string[] {
  return PDF_COLUMNS.map((col) => col.header)
}
