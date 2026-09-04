import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { roundPercentsToNearestFive, summarizeApprovedExpenses } from './expense-summary.ts'

describe('roundPercentsToNearestFive', () => {
  it('rounds the documented example to 5% steps that sum to 100', () => {
    const mix = roundPercentsToNearestFive([
      { category: 'Materials', amount: 47.83 },
      { category: 'Labour', amount: 31.27 },
      { category: 'Equipment', amount: 12.11 },
      { category: 'Miscellaneous', amount: 8.79 },
    ])
    assert.deepEqual(mix, [
      { category: 'Materials', percent: 50 },
      { category: 'Labour', percent: 30 },
      { category: 'Equipment', percent: 10 },
      { category: 'Miscellaneous', percent: 10 },
    ])
    assert.equal(mix.reduce((sum, row) => sum + row.percent, 0), 100)
  })

  it('aggregates duplicate categories before rounding', () => {
    const mix = roundPercentsToNearestFive([
      { category: 'Materials', amount: 40 },
      { category: 'Materials', amount: 10 },
      { category: 'Labour', amount: 50 },
    ])
    assert.deepEqual(mix, [
      { category: 'Materials', percent: 50 },
      { category: 'Labour', percent: 50 },
    ])
  })
})

describe('summarizeApprovedExpenses', () => {
  it('ignores unapproved rows and omits an empty mix', () => {
    assert.equal(
      summarizeApprovedExpenses([
        { amount: 1000, category: 'Materials', status: 'pending' },
        { amount: 500, category: 'Labour', status: 'rejected' },
      ]),
      undefined,
    )
    assert.equal(summarizeApprovedExpenses([]), undefined)
  })

  it('maps custom category names into the four public buckets', () => {
    const mix = summarizeApprovedExpenses([
      { amount: 70, category: 'Site Materials', status: 'approved' },
      { amount: 30, category: 'Daily wages', status: 'approved' },
    ])
    assert.ok(mix)
    assert.equal(mix.find((row) => row.category === 'Materials')?.percent, 70)
    assert.equal(mix.find((row) => row.category === 'Labour')?.percent, 30)
    assert.deepEqual(
      mix.map((row) => row.category),
      ['Materials', 'Labour'],
    )
  })
})
