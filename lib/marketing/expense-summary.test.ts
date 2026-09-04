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
    const summary = summarizeApprovedExpenses([
      { amount: 70, category: 'Site Materials', status: 'approved' },
      { amount: 30, category: 'Daily wages', status: 'approved' },
    ])
    assert.ok(summary)
    const mix = summary.spendMix
    assert.equal(mix.find((row) => row.category === 'Materials')?.percent, 70)
    assert.equal(mix.find((row) => row.category === 'Labour')?.percent, 30)
    assert.deepEqual(
      mix.map((row) => row.category),
      ['Materials', 'Labour'],
    )
  })

  it('publishes recorded subcategory names with exact rupee totals', () => {
    const summary = summarizeApprovedExpenses([
      { amount: 2391, category: 'Materials', status: 'approved', description: 'Cement - bags' },
      {
        amount: 2392,
        category: 'Materials',
        status: 'approved',
        description: 'Steel delivery for villa',
      },
      { amount: 3127, category: 'Labour', status: 'approved', description: 'Mason wages' },
      {
        amount: 1211,
        category: 'Equipment',
        status: 'approved',
        description: 'Mixer - daily hire',
      },
      {
        amount: 879,
        category: 'Miscellaneous',
        status: 'approved',
        description: 'Night haul of leftover shuttering',
        subcategoryName: 'Villa special tiles',
      },
    ])
    assert.ok(summary)
    assert.deepEqual(
      summary.spendMix.map((row) => row.percent),
      [50, 30, 10, 10],
    )
    assert.deepEqual(
      summary.spendMix.map((row) => row.amount),
      [4783, 3127, 1211, 879],
    )
    assert.equal(
      summary.spendMix.reduce((sum, row) => sum + row.percent, 0),
      100,
    )
    assert.deepEqual(summary.expenseSheet, [
      { category: 'Materials', subcategory: 'Cement', percent: 25, amount: 2391, count: 1 },
      { category: 'Materials', subcategory: null, percent: 25, amount: 2392, count: 1 },
      { category: 'Labour', subcategory: null, percent: 30, amount: 3127, count: 1 },
      { category: 'Equipment', subcategory: 'Mixer', percent: 10, amount: 1211, count: 1 },
      {
        category: 'Miscellaneous',
        subcategory: 'Villa special tiles',
        percent: 10,
        amount: 879,
        count: 1,
      },
    ])
    assert.equal(
      summary.expenseSheet
        .filter((row) => row.category === 'Materials')
        .reduce((sum, row) => sum + row.amount, 0),
      4783,
    )
    assert.deepEqual(summary.subcategoriesByCategory, [
      { category: 'Materials', names: ['Cement'] },
      { category: 'Equipment', names: ['Mixer'] },
      { category: 'Miscellaneous', names: ['Villa special tiles'] },
    ])
    const blob = JSON.stringify(summary)
    assert.equal(blob.includes('Steel delivery'), false)
    assert.equal(blob.includes('Night haul'), false)
  })

  it('prefers a split subcategory over a custom description', () => {
    const summary = summarizeApprovedExpenses([
      {
        amount: 100,
        category: 'Materials',
        status: 'approved',
        subcategoryName: 'Steel',
        description: 'Steel delivery for villa',
      },
    ])
    assert.deepEqual(summary?.expenseSheet, [
      { category: 'Materials', subcategory: 'Steel', percent: 100, amount: 100, count: 1 },
    ])
    assert.equal(JSON.stringify(summary).includes('Steel delivery'), false)
  })
})
