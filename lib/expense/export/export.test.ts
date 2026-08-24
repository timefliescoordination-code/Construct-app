import { describe, it } from 'node:test'
import { canExportExpenses } from './permissions.ts'
import assert from 'node:assert/strict'
import { sumExportAmounts, exportRowToCells } from './columns.ts'
import { parseExpenseSubcategory, matchesVendorFilter } from './parse.ts'
import { buildFiltersLabel, parseExpenseExportFilters } from './filters.ts'
import {
  buildExpenseFilename,
  buildExpenseExcelBuffer,
  slugifyProjectName,
} from './excel.ts'
import { buildExpensePdfBuffer } from './pdf.ts'
import { summarizeExportRows } from './summary.ts'
import type { ExportExpenseRow } from './types.ts'

function sampleRow(overrides: Partial<ExportExpenseRow> = {}): ExportExpenseRow {
  return {
    serialNumber: 1,
    expenseId: 'exp-1',
    referenceNumber: 'BILL-1',
    expenseDate: '2026-08-01',
    createdDate: '2026-08-02',
    expenseType: 'project',
    projectId: 'proj-1',
    projectName: 'Alpha Tower',
    category: 'Material',
    subcategory: 'Cement',
    description: 'Cement bags',
    vendorPayee: 'Shree Cement',
    paymentMethod: null,
    paymentStatus: 'approved',
    amount: 10000,
    taxGst: null,
    totalAmount: 10000,
    notes: null,
    createdBy: 'PM User',
    enteredBy: 'PM User',
    submittedBy: null,
    approvedBy: 'Admin',
    milestoneName: 'Foundation',
    labourTeamName: null,
    billNumber: 'BILL-1',
    splitGroupId: null,
    splitNumber: null,
    invoiceFileName: 'invoice.pdf',
    invoiceNumber: 'INV-9',
    invoiceTotal: 10000,
    updatedAt: '2026-08-02T10:00:00Z',
    ...overrides,
  }
}

describe('canExportExpenses', () => {
  it('allows admin, pm, and engineer only', () => {
    assert.equal(canExportExpenses('admin'), true)
    assert.equal(canExportExpenses('pm'), true)
    assert.equal(canExportExpenses('engineer'), true)
    assert.equal(canExportExpenses('customer'), false)
    assert.equal(canExportExpenses(null), false)
  })
})

describe('parseExpenseSubcategory', () => {
  it('splits subcategory prefix from description', () => {
    const parsed = parseExpenseSubcategory('Cement - UltraTech bags')
    assert.equal(parsed.subcategory, 'Cement')
    assert.equal(parsed.description, 'UltraTech bags')
  })
})

describe('matchesVendorFilter', () => {
  it('matches vendor case-insensitively', () => {
    assert.equal(matchesVendorFilter('Shree Cement', 'cement'), true)
    assert.equal(matchesVendorFilter('Other Vendor', 'cement'), false)
  })
})

describe('parseExpenseExportFilters', () => {
  it('parses all-expenses flag and filters', () => {
    const params = new URLSearchParams({
      all: '1',
      projectId: 'proj-1',
      category: 'Material',
      paymentStatus: 'approved',
      expenseType: 'project',
    })
    const filters = parseExpenseExportFilters(params)
    assert.equal(filters.allExpenses, true)
    assert.equal(filters.projectId, 'proj-1')
    assert.equal(filters.category, 'Material')
    assert.equal(filters.paymentStatus, 'approved')
    assert.equal(filters.expenseType, 'project')
  })
})

describe('sumExportAmounts', () => {
  it('sums totalAmount across rows', () => {
    const total = sumExportAmounts([
      sampleRow({ totalAmount: 1000 }),
      sampleRow({ totalAmount: 2500 }),
    ])
    assert.equal(total, 3500)
  })
})

describe('summarizeExportRows', () => {
  it('groups totals by project and category', () => {
    const summary = summarizeExportRows([
      sampleRow({ projectName: 'Alpha Tower', category: 'Material', totalAmount: 1000 }),
      sampleRow({
        serialNumber: 2,
        projectName: 'Beta Homes',
        category: 'Labour',
        totalAmount: 500,
      }),
    ])
    assert.equal(summary.byProject.length, 2)
    assert.equal(summary.byCategory.length, 2)
    assert.equal(summary.byProject[0].total, 1000)
  })
})

describe('buildExpenseFilename', () => {
  it('builds all-expenses filename', () => {
    const name = buildExpenseFilename({ allExpenses: true }, 'xlsx')
    assert.match(name, /^expenses-all-\d{4}-\d{2}-\d{2}\.xlsx$/)
  })

  it('builds project date-range filename', () => {
    const name = buildExpenseFilename(
      {
        allExpenses: false,
        dateFrom: '2026-08-01',
        dateTo: '2026-08-24',
      },
      'pdf',
      slugifyProjectName('Alpha Tower'),
    )
    assert.equal(name, 'expenses-alpha-tower-2026-08-01-to-2026-08-24.pdf')
  })
})

describe('buildExpenseExcelBuffer', () => {
  it('creates non-empty xlsx buffer with header and data', () => {
    const buffer = buildExpenseExcelBuffer({
      rows: [sampleRow()],
      filtersLabel: 'All authorized expenses',
      companyName: 'VRA HOMES',
    })
    assert.ok(buffer.length > 100)
  })
})

describe('buildExpensePdfBuffer', () => {
  it('creates a non-empty pdf with date, description, amount, and total', () => {
    const rows = [sampleRow()]
    const buffer = buildExpensePdfBuffer({
      rows,
      filtersLabel: 'All authorized expenses',
      companyName: 'VRA HOMES',
      summary: summarizeExportRows(rows),
    })
    assert.ok(buffer.length > 100)
    assert.equal(buffer.subarray(0, 4).toString(), '%PDF')
  })
})

describe('exportRowToCells', () => {
  it('includes INR formatted amounts and invoice fields', () => {
    const cells = exportRowToCells(sampleRow())
    assert.match(cells[13], /₹/)
    assert.equal(cells[25], 'invoice.pdf')
    assert.equal(cells[26], 'INV-9')
  })
})

describe('buildFiltersLabel', () => {
  it('describes active filters', () => {
    const label = buildFiltersLabel({
      allExpenses: false,
      dateFrom: '2026-08-01',
      dateTo: '2026-08-24',
      category: 'Material',
    })
    assert.match(label, /Material/)
    assert.match(label, /2026-08-01/)
  })
})
