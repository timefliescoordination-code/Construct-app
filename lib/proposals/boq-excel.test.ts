import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import {
  buildBoqTemplateWorkbook,
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

  it('parses the downloadable template including a group and measurements', () => {
    const result = parseBoqWorkbookData(buildBoqTemplateWorkbook())
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.kind, 'heading')
    assert.equal(result.items[0]?.description, 'Concrete quantity')
    const concrete = result.items.find((item) => item.description === 'Concrete')
    assert.equal(concrete?.measurements?.height, '1')
    assert.equal(concrete?.quantity, '100')
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

describe('grouped and measurement BOQ import', () => {
  it('keeps description-only rows as group headings', () => {
    const result = parseBoqMatrix([
      ['Description', 'Qty', 'Unit', 'Rate'],
      ['Concrete quantity', '', '', ''],
      ['Steel', 2, 'MT', 70000],
      ['Shuttering', 50, 'sqft', 45],
      ['Concrete', 10, 'cu.ft', 150],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items.length, 4)
    assert.equal(result.items[0]?.kind, 'heading')
    assert.equal(result.items[0]?.description, 'Concrete quantity')
    assert.equal(result.items[1]?.kind, 'item')
    assert.equal(result.items[1]?.nested, true)
    assert.equal(result.items[1]?.description, 'Steel')
    assert.equal(result.items[3]?.description, 'Concrete')
  })

  it('reads Nos / L / B / H sub-headers under Quantity', () => {
    const result = parseBoqMatrix([
      ['S.No', 'Description', 'Quantity', '', '', '', 'Unit', 'Rate'],
      ['', '', 'Nos', 'L', 'B', 'H', '', ''],
      ['1', 'Concrete quantity', '', '', '', '', '', ''],
      ['1.1', 'Steel', '', '', '', '', 'MT', 70000],
      ['1.2', 'Concrete', 1, 10, 10, 1, 'cu.ft', 150],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.kind, 'heading')
    const concrete = result.items.find((item) => item.description === 'Concrete')
    assert.equal(concrete?.kind, 'item')
    assert.equal(concrete?.quantity, '100')
    assert.equal(concrete?.unit, 'cu.ft')
    assert.equal(concrete?.measurements?.nos, '1')
    assert.equal(concrete?.measurements?.length, '10')
    assert.equal(concrete?.measurements?.breadth, '10')
    assert.equal(concrete?.measurements?.height, '1')
    const steel = result.items.find((item) => item.description === 'Steel')
    assert.equal(steel?.unit, 'MT')
    assert.equal(steel?.rate, '70000')
  })

  it('promotes numbered parents when children follow', () => {
    const result = parseBoqMatrix([
      ['Description', 'Qty', 'Unit', 'Rate'],
      ['1 Earthwork', '', '', ''],
      ['1.1 Excavation', 20, 'cu.ft', 80],
      ['1.2 Filling', 8, 'cu.ft', 60],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items[0]?.kind, 'heading')
    assert.equal(result.items[1]?.kind, 'item')
    assert.equal(result.items[1]?.description, '1.1 Excavation')
  })

  it('still reads a flat sheet without groups', () => {
    const result = parseBoqMatrix([
      ['S.No', 'Description', 'Qty', 'Unit', 'Rate'],
      [1, 'RCC foundation', 10, 'cu.ft', 150],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0]?.kind, 'item')
    assert.equal(result.items[0]?.quantity, '10')
  })

  it('reads Group / Sub-group contractor sheets with a/b/c children', () => {
    const result = parseBoqMatrix([
      ['Sl.No', 'Group', 'Sub-group', 'Qty', 'Unit', 'Rate (₹)', 'Total (₹)'],
      [
        1,
        '',
        'Earth Work Excavation in all types of soil including trimming sides.',
        2068.3,
        'cft',
        45,
        '93,074',
      ],
      [2, '', 'PCC Below Footing using 40mm jelly 1:4:8 with M-sand.', 4.9, 'm3', '7,000', '34,300'],
      [
        4,
        '',
        'RCC For Footing using 20mm jelly M25 (1:1:2) including steel and shuttering.',
        13.1,
        'm3',
        '',
        '',
      ],
      ['', '', 'a. Concrete M25 (1:1:2)', '', '', '7,290', '95,499'],
      ['', '', 'b. Steel 550D As per spec', '', '', '70,000', '1,71,898'],
      ['', '', 'c. Shuttering (plywood or Steel)', '', '', 85, 1114],
      [6, '', 'SB Masonry in CM 1:6', 10.2, 'm3', 6200, 63240],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    const earth = result.items.find((item) => item.description.includes('Earth Work Excavation'))
    assert.equal(earth?.kind, 'item')
    assert.equal(earth?.nested, false)
    assert.equal(earth?.quantity, '2068.3')
    assert.equal(earth?.unit, 'cft')
    assert.equal(earth?.rate, '45')

    const rcc = result.items.find((item) => item.description.includes('RCC For Footing'))
    assert.equal(rcc?.kind, 'heading')
    assert.equal(rcc?.nested, false)

    const concrete = result.items.find((item) => item.description.startsWith('a. Concrete'))
    assert.equal(concrete?.kind, 'item')
    assert.equal(concrete?.nested, true)
    assert.equal(concrete?.quantity, '13.1')
    assert.equal(concrete?.unit, 'm3')
    assert.equal(concrete?.rate, '7290')

    const steel = result.items.find((item) => item.description.startsWith('b. Steel'))
    assert.equal(steel?.nested, true)
    assert.equal(steel?.quantity, '2.4557')
    assert.equal(steel?.rate, '70000')

    const masonry = result.items.find((item) => item.description.includes('SB Masonry'))
    assert.equal(masonry?.kind, 'item')
    assert.equal(masonry?.nested, false)
    assert.equal(masonry?.quantity, '10.2')
  })

  it('infers columns when headers are missing', () => {
    const result = parseBoqMatrix([
      [1, 'Earthwork excavation', 20, 'cft', 80, 1600],
      [2, 'PCC 1:4:8', 5, 'm3', 7000, 35000],
    ])
    assert.equal('error' in result, false)
    if ('error' in result) return
    assert.equal(result.items.length, 2)
    assert.equal(result.items[0]?.description, 'Earthwork excavation')
    assert.equal(result.items[0]?.unit, 'cft')
    assert.equal(result.items[1]?.rate, '7000')
  })
})
