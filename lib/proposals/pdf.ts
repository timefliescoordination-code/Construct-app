import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { format } from 'date-fns'
import type { PublicProposalDocument } from '@/lib/proposals/types'
import { formatAreaRateDisplay } from '@/lib/proposals/calculations'
import { PROPOSAL_METHOD_LABELS, formatProposalNumber } from '@/lib/proposals/constants'

const MARGIN_X = 48
const INK: [number, number, number] = [28, 28, 28]
const MUTED: [number, number, number] = [112, 112, 112]
const RULE: [number, number, number] = [210, 210, 210]

function formatPdfAmount(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0
  return `Rs. ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(safe)}`
}

function sectionItems(doc: PublicProposalDocument, section: 'built_up' | 'additional' | 'boq') {
  return doc.items
    .filter((item) => item.section === section)
    .sort((a, b) => a.sort_order - b.sort_order)
}

function drawSectionTable(
  pdf: jsPDF,
  title: string,
  rows: Array<[string, string, string, string]>,
  startY: number,
) {
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.setTextColor(...INK)
  pdf.text(title, MARGIN_X, startY)

  autoTable(pdf, {
    startY: startY + 8,
    head: [['S.No', 'Description', 'Area / Unit Rate', 'Price']],
    body: rows,
    theme: 'plain',
    margin: { left: MARGIN_X, right: MARGIN_X },
    styles: {
      font: 'helvetica',
      fontSize: 9,
      textColor: INK,
      cellPadding: { top: 6, right: 6, bottom: 6, left: 6 },
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fontStyle: 'bold',
      fontSize: 8,
      textColor: MUTED,
    },
    columnStyles: {
      0: { cellWidth: 36 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 150 },
      3: { cellWidth: 90, halign: 'right' },
    },
    didDrawCell: (data) => {
      if (data.section === 'head') {
        pdf.setDrawColor(...RULE)
        pdf.setLineWidth(0.5)
        pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height)
      }
    },
  })

  return (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40
}

export function downloadProposalPdf(document: PublicProposalDocument) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  let y = 48

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(16)
  pdf.setTextColor(...INK)
  pdf.text(document.company.company_name || 'VRA HOMES', MARGIN_X, y)

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text('CONSTRUCTION PROPOSAL', MARGIN_X, y + 16)

  y += 40
  pdf.setDrawColor(...RULE)
  pdf.line(MARGIN_X, y, pageWidth - MARGIN_X, y)
  y += 22

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(13)
  pdf.setTextColor(...INK)
  pdf.text(document.project_name, MARGIN_X, y)
  y += 16

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(...MUTED)
  pdf.text(document.project_address || '', MARGIN_X, y, { maxWidth: pageWidth - MARGIN_X * 2 })
  y += 28

  const displayNumber = formatProposalNumber(document.proposal_number, document.version_number)
  const meta = [
    `Proposal #${displayNumber}`,
    format(new Date(document.proposal_date), 'd MMM yyyy'),
    PROPOSAL_METHOD_LABELS[document.method],
  ]
  if (document.valid_until) {
    meta.push(`Valid until ${format(new Date(document.valid_until), 'd MMM yyyy')}`)
  }
  pdf.text(meta.join('   ·   '), MARGIN_X, y)
  y += 24

  const money = (n: number) => formatPdfAmount(n)

  if (document.method === 'sqft') {
    const built = sectionItems(document, 'built_up').map((item, index) => [
      String(index + 1),
      item.description,
      formatAreaRateDisplay(item.quantity, item.unit, item.rate, formatPdfAmount),
      money(item.price),
    ])
    if (built.length) {
      y = drawSectionTable(pdf, 'AS PER BUILT-UP AREA', built as Array<[string, string, string, string]>, y) + 22
    }
    const extra = sectionItems(document, 'additional').map((item, index) => [
      String(index + 1),
      item.description,
      formatAreaRateDisplay(item.quantity, item.unit, item.rate, formatPdfAmount),
      money(item.price),
    ])
    if (extra.length) {
      y = drawSectionTable(pdf, 'ADDITIONAL WORKS', extra as Array<[string, string, string, string]>, y) + 22
    }
  } else {
    const boq = sectionItems(document, 'boq').map((item, index) => [
      String(index + 1),
      item.description,
      formatAreaRateDisplay(item.quantity, item.unit, item.rate, formatPdfAmount),
      money(item.price),
    ])
    y = drawSectionTable(pdf, 'BOQ', boq as Array<[string, string, string, string]>, y) + 22
  }

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(12)
  pdf.setTextColor(...INK)
  pdf.text('TOTAL PROPOSAL VALUE', MARGIN_X, y)
  pdf.text(money(document.grand_total), pageWidth - MARGIN_X, y, { align: 'right' })
  y += 28

  if (document.notes.trim()) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(11)
    pdf.text('NOTES', MARGIN_X, y)
    y += 14
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(...MUTED)
    const notes = pdf.splitTextToSize(document.notes, pageWidth - MARGIN_X * 2)
    pdf.text(notes, MARGIN_X, y)
  }

  pdf.save(`${displayNumber.replaceAll('/', '-')}-proposal.pdf`)
}
