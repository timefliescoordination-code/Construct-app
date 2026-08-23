import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sumCostingRows, summarizeChangeRequestFinancials } from './calculations.ts'

describe('sumCostingRows', () => {
  it('sums numeric and string prices', () => {
    const total = sumCostingRows([
      { price: 1000 },
      { price: '2500.50' },
      { price: 0 },
    ])
    assert.equal(total, 3500.5)
  })

  it('treats missing prices as zero', () => {
    assert.equal(sumCostingRows([{ price: 100 }, { price: '' as unknown as number }]), 100)
  })
})

describe('summarizeChangeRequestFinancials', () => {
  it('aggregates pending and approved values by status', () => {
    const summary = summarizeChangeRequestFinancials([
      {
        status: 'under_review',
        estimated_additional_days: 3,
        active_costing_revision: { total_price: 5000 },
      },
      {
        status: 'approved',
        estimated_additional_days: 5,
        active_costing_revision: { total_price: 12000 },
      },
      {
        status: 'draft',
        estimated_additional_days: null,
        active_costing_revision: null,
      },
    ])

    assert.equal(summary.pendingValue, 5000)
    assert.equal(summary.approvedChangeValue, 12000)
    assert.equal(summary.pendingScheduleDays, 3)
    assert.equal(summary.approvedScheduleDays, 5)
    assert.equal(summary.byStatus.draft, 1)
  })
})
