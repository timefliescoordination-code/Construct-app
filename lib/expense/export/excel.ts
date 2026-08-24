import { format } from 'date-fns'
import type { ExpenseExportFilters } from './types.ts'
import type { ExportExpenseRow } from './types.ts'
import {
  EXPORT_COLUMN_HEADERS,
  exportRowToCells,
  sumExportAmounts,
} from './columns.ts'
import { formatINR } from '../../currency.ts'
import * as XLSX from 'xlsx'

export type ExcelExportInput = {
  rows: ExportExpenseRow[]
  filtersLabel: string
  companyName: string
  exportedAt?: Date
}

export function buildExpenseExcelBuffer(input: ExcelExportInput): Buffer {
  const exportedAt = input.exportedAt ?? new Date()
  const totalAmount = sumExportAmounts(input.rows)
  const headerRowIndex = 5
  const dataStartRow = headerRowIndex + 1

  const sheetRows: string[][] = [
    ['Expense Export Report'],
    [input.companyName],
    [input.filtersLabel],
    [
      `Exported: ${format(exportedAt, 'dd MMM yyyy HH:mm')} · Records: ${input.rows.length} · Total: ${formatINR(totalAmount)}`,
    ],
    [],
    [...EXPORT_COLUMN_HEADERS],
    ...input.rows.map(exportRowToCells),
    [],
    [
      'TOTAL',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      formatINR(totalAmount),
    ],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet(sheetRows)
  const lastCol = XLSX.utils.encode_col(EXPORT_COLUMN_HEADERS.length - 1)
  const lastDataRow = dataStartRow + input.rows.length - 1

  worksheet['!cols'] = EXPORT_COLUMN_HEADERS.map((header) => ({
    wch: Math.min(Math.max(header.length + 2, 14), 42),
  }))

  if (input.rows.length > 0) {
    worksheet['!autofilter'] = {
      ref: `A${headerRowIndex + 1}:${lastCol}${Math.max(lastDataRow, headerRowIndex + 1)}`,
    }
  }

  worksheet['!freeze'] = { xSplit: 0, ySplit: headerRowIndex, topLeftCell: 'A6', activePane: 'bottomLeft' }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Expenses')
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer
}

export function buildExpenseFilename(
  filters: ExpenseExportFilters,
  formatExt: 'xlsx' | 'pdf',
  projectSlug?: string | null,
): string {
  const today = format(new Date(), 'yyyy-MM-dd')
  if (filters.allExpenses) {
    return `expenses-all-${today}.${formatExt}`
  }
  if (filters.dateFrom && filters.dateTo) {
    const slug = projectSlug ? `${projectSlug}-` : ''
    return `expenses-${slug}${filters.dateFrom}-to-${filters.dateTo}.${formatExt}`
  }
  if (projectSlug) {
    return `expenses-${projectSlug}-${today}.${formatExt}`
  }
  return `expenses-${today}.${formatExt}`
}

export function slugifyProjectName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
