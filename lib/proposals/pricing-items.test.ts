import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { keepItemsWhenChangingMethod } from './pricing-items.ts'
import type { ProposalItemDraft } from './types.ts'

const boqItem = (description: string): ProposalItemDraft => ({
  section: 'boq',
  description,
  quantity: '10',
  unit: 'cu.ft',
  rate: '150',
  kind: 'item',
})

describe('keepItemsWhenChangingMethod', () => {
  it('keeps entered BOQ rows when switching to sqft', () => {
    const items = [boqItem('Steel')]
    const next = keepItemsWhenChangingMethod(items, 'sqft')
    assert.equal(next.some((item) => item.section === 'boq' && item.description === 'Steel'), true)
    assert.equal(next.some((item) => item.section === 'built_up'), true)
  })

  it('keeps entered sqft rows when switching to BOQ', () => {
    const items: ProposalItemDraft[] = [
      { section: 'built_up', description: 'Construction', quantity: '1800', unit: 'sqft', rate: '2100' },
    ]
    const next = keepItemsWhenChangingMethod(items, 'boq')
    assert.equal(next.some((item) => item.section === 'built_up' && item.description === 'Construction'), true)
    assert.equal(next.some((item) => item.section === 'boq'), true)
  })

  it('does not replace existing rows for the same method', () => {
    const items = [boqItem('Steel'), boqItem('Concrete')]
    const next = keepItemsWhenChangingMethod(items, 'boq')
    assert.equal(next.length, 2)
    assert.equal(next[0]?.description, 'Steel')
  })
})
