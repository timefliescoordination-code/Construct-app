import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeProposalLines,
  computeProposalTotals,
  linePrice,
  roundMoney,
  validateProposalForShare,
} from './calculations.ts'

describe('roundMoney', () => {
  it('rounds to two decimal places', () => {
    assert.equal(roundMoney(10.005), 10.01)
    assert.equal(roundMoney(1.234), 1.23)
  })

  it('treats non-finite values as zero', () => {
    assert.equal(roundMoney(Number.NaN), 0)
  })
})

describe('linePrice', () => {
  it('multiplies quantity and rate using numeric values', () => {
    assert.equal(linePrice(1800, 2100), 3780000)
  })

  it('parses string quantities without currency formatting', () => {
    assert.equal(linePrice('1,800', '2100'), 3780000)
  })
})

describe('computeProposalTotals sqft', () => {
  it('sums built-up and additional works separately', () => {
    const lines = computeProposalLines([
      { section: 'built_up', description: 'Construction', quantity: 1800, unit: 'sqft', rate: 2100 },
      { section: 'additional', description: 'Compound Wall', quantity: 1, unit: 'lot', rate: 200000 },
      { section: 'additional', description: 'Gate', quantity: 1, unit: 'nos', rate: 50000 },
    ])
    const totals = computeProposalTotals('sqft', lines)
    assert.equal(totals.builtUpTotal, 3780000)
    assert.equal(totals.additionalWorksTotal, 250000)
    assert.equal(totals.grandTotal, 4030000)
  })

  it('allows empty additional works', () => {
    const lines = computeProposalLines([
      { section: 'built_up', description: 'Construction', quantity: 1000, unit: 'sqft', rate: 2000 },
    ])
    const totals = computeProposalTotals('sqft', lines)
    assert.equal(totals.additionalWorksTotal, 0)
    assert.equal(totals.grandTotal, 2000000)
  })
})

describe('computeProposalTotals boq', () => {
  it('sums all BOQ item prices', () => {
    const lines = computeProposalLines([
      { section: 'boq', description: 'Foundation', quantity: 10, unit: 'cu.ft', rate: 150 },
      { section: 'boq', description: 'Steel', quantity: 2, unit: 'MT', rate: 70000 },
    ])
    const totals = computeProposalTotals('boq', lines)
    assert.equal(totals.grandTotal, 141500)
    assert.equal(totals.builtUpTotal, 0)
  })

  it('ignores group headings and uses measurement takeoff for quantity', () => {
    const lines = computeProposalLines([
      { section: 'boq', description: 'Concrete quantity', quantity: 0, unit: '', rate: 0, kind: 'heading' },
      { section: 'boq', description: 'Steel', quantity: 2, unit: 'MT', rate: 70000, kind: 'item' },
      {
        section: 'boq',
        description: 'Concrete',
        quantity: 0,
        unit: 'cu.ft',
        rate: 150,
        kind: 'item',
        measurements: { nos: '1', length: '10', breadth: '10', height: '1' },
      },
    ])
    assert.equal(lines[0]?.price, 0)
    assert.equal(lines[2]?.quantity, 100)
    assert.equal(lines[2]?.price, 15000)
    const totals = computeProposalTotals('boq', lines)
    assert.equal(totals.grandTotal, 155000)
  })
})

describe('validateProposalForShare', () => {
  it('requires project address and at least one item', () => {
    const missingAddress = validateProposalForShare({
      projectName: 'Arun Residence',
      projectAddress: '',
      method: 'sqft',
      items: [{ section: 'built_up', description: 'Construction', quantity: 1, unit: 'sqft', rate: 1 }],
    })
    assert.equal(typeof missingAddress, 'string')

    const missingItems = validateProposalForShare({
      projectName: 'Arun Residence',
      projectAddress: 'Chennai',
      method: 'boq',
      items: [],
    })
    assert.equal(typeof missingItems, 'string')
  })

  it('does not require quantity or unit on group headings', () => {
    const error = validateProposalForShare({
      projectName: 'Arun Residence',
      projectAddress: 'Chennai',
      method: 'boq',
      items: [
        { section: 'boq', description: 'Concrete quantity', quantity: 0, unit: '', rate: 0, kind: 'heading' },
        { section: 'boq', description: 'Steel', quantity: 2, unit: 'MT', rate: 70000, kind: 'item' },
      ],
    })
    assert.equal(error, null)
  })

  it('accepts a valid sqft proposal', () => {
    const error = validateProposalForShare({
      projectName: 'Arun Residence',
      projectAddress: 'Chennai',
      method: 'sqft',
      items: [{ section: 'built_up', description: 'Construction', quantity: 1800, unit: 'sqft', rate: 2100 }],
    })
    assert.equal(error, null)
  })

  it('does not delete leftover items from the other pricing method when sharing', () => {
    const error = validateProposalForShare({
      projectName: 'Arun Residence',
      projectAddress: 'Chennai',
      method: 'sqft',
      items: [
        { section: 'built_up', description: 'Construction', quantity: 1800, unit: 'sqft', rate: 2100 },
        { section: 'boq', description: 'Steel takeoff still in progress', quantity: 0, unit: '', rate: 0 },
      ],
    })
    assert.equal(error, null)
  })
})
