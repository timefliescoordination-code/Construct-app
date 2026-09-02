import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { boqSerialLabel, moveItemBlock, quantityFromMeasurements } from './boq-structure.ts'

describe('quantityFromMeasurements', () => {
  it('multiplies filled dimensions and treats missing ones as 1', () => {
    assert.equal(
      quantityFromMeasurements({ nos: '1', length: '10', breadth: '10', height: '1' }, 0),
      100,
    )
    assert.equal(
      quantityFromMeasurements({ nos: '', length: '12', breadth: '10', height: '' }, 0),
      120,
    )
  })

  it('falls back when no measurement values are present', () => {
    assert.equal(quantityFromMeasurements(null, '8'), 8)
    assert.equal(
      quantityFromMeasurements({ nos: '', length: '', breadth: '', height: '' }, '3'),
      3,
    )
  })
})

describe('boqSerialLabel', () => {
  it('numbers headings, children, and standalone items', () => {
    const items = [
      { section: 'boq', kind: 'heading' as const, nested: false },
      { section: 'boq', kind: 'item' as const, nested: true },
      { section: 'boq', kind: 'item' as const, nested: true },
      { section: 'boq', kind: 'item' as const, nested: false },
    ]
    assert.equal(boqSerialLabel(items, 0, 'boq'), '1')
    assert.equal(boqSerialLabel(items, 1, 'boq'), '1.1')
    assert.equal(boqSerialLabel(items, 2, 'boq'), '1.2')
    assert.equal(boqSerialLabel(items, 3, 'boq'), '2')
  })
})

describe('moveItemBlock', () => {
  it('moves a heading together with its children', () => {
    const items = [
      { id: 'h1', kind: 'heading' as const, section: 'boq', nested: false },
      { id: 'a', kind: 'item' as const, section: 'boq', nested: true },
      { id: 'h2', kind: 'heading' as const, section: 'boq', nested: false },
      { id: 'b', kind: 'item' as const, section: 'boq', nested: true },
    ]
    const moved = moveItemBlock(items, 0, 1)
    assert.deepEqual(moved.map((item) => item.id), ['h2', 'b', 'h1', 'a'])
  })
})
