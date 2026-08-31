import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  mergeImportedBoqItems,
  parseBoqMatrix,
  parseBoqWorkbookData,
} from './boq-excel.ts'
import type { ProposalItemDraft } from './types.ts'

describe('parseBoqMatrix', () => {
  it('reads a standard headered BOQ sheet', () => {
    const result = parseBoqMatrix([
      ['S.No', 'Description', 'Qty', 'Unit', 'Rate'],
      [1, 'RCC foundation', 10, 'cu.ft', 150],
      [2, 'Steel', 2, 'MT', 70000],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items.length, 2)
    assert.equal(result.items[0]?.description, 'RCC foundation')
    assert.equal(result.items[0]?.quantity, '10')
    assert.equal(result.items[0]?.unit, 'cu.ft')
    assert.equal(result.items[0]?.rate, '150')
    assert.equal(result.items[0]?.section, 'boq')
    assert.equal(result.items[1]?.description, 'Steel')
  })

  it('skips title rows and finds the header later', () => {
    const result = parseBoqMatrix([
      ['VRA HOMES'],
      ['Bill of Quantities'],
      [],
      ['Item', 'Particulars', 'Quantity', 'UOM', 'Rate (Rs)', 'Amount'],
      ['A', 'Earthwork', 20, 'cu.ft', 80, 1600],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0]?.description, 'Earthwork')
    assert.equal(result.items[0]?.unit, 'cu.ft')
  })

  it('derives rate from amount when rate is missing', () => {
    const result = parseBoqMatrix([
      ['Description', 'Qty', 'Amount'],
      ['Compound wall', 10, 25000],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.rate, '2500')
    assert.equal(result.items[0]?.quantity, '10')
  })

  it('treats amount-only rows as a lump sum', () => {
    const result = parseBoqMatrix([
      ['Description', 'Amount'],
      ['Design fee', 50000],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.quantity, '1')
    assert.equal(result.items[0]?.rate, '50000')
  })

  it('skips total rows and empty descriptions', () => {
    const result = parseBoqMatrix([
      ['Description', 'Qty', 'Unit', 'Rate'],
      ['Plastering', 100, 'sqft', 45],
      ['Grand Total', 100, 'sqft', 45],
      ['', 1, 'item', 10],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0]?.description, 'Plastering')
    assert.ok(result.skipped >= 1)
  })

  it('parses comma-formatted numbers', () => {
    const result = parseBoqMatrix([
      ['Description', 'Qty', 'Rate'],
      ['Steel', '1,800', '2,100'],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.quantity, '1800')
    assert.equal(result.items[0]?.rate, '2100')
  })
})

describe('parseBoqWorkbookData', () => {
  it('reads an xlsx buffer', () => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ['Description', 'Qty', 'Unit', 'Rate'],
        ['Gate', 1, 'nos', 45000],
      ]),
      'BOQ',
    )
    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as Uint8Array
    const result = parseBoqWorkbookData(buffer)
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.description, 'Gate')
    assert.equal(result.items[0]?.unit, 'nos')
  })
})

describe('mergeImportedBoqItems', () => {
  it('replaces existing BOQ rows and keeps other sections', () => {
    const current: ProposalItemDraft[] = [
      { section: 'built_up', description: 'Construction', quantity: '1800', unit: 'sqft', rate: '2100' },
      { section: 'boq', description: 'Old', quantity: '1', unit: 'item', rate: '1' },
    ]
    const imported: ProposalItemDraft[] = [
      { section: 'boq', description: 'New', quantity: '2', unit: 'nos', rate: '10' },
    ]
    const merged = mergeImportedBoqItems(current, imported)
    assert.equal(merged.length, 2)
    assert.equal(merged[0]?.section, 'built_up')
    assert.equal(merged[1]?.description, 'New')
  })
})
