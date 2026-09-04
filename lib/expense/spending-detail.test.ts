import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildExpenseDetailRows,
  expenseLineLabels,
  expenseSubcategoryLabel,
} from './spending-detail.ts'

describe('expenseSubcategoryLabel', () => {
  it('prefers labour team, then split name, then description prefix', () => {
    assert.equal(
      expenseSubcategoryLabel({
        category: 'Labour',
        amount: 10,
        status: 'approved',
        labourTeamName: 'Mason crew',
        subcategoryName: 'Cement',
        description: 'Steel - leftover',
      }),
      'Mason crew',
    )
    assert.equal(
      expenseSubcategoryLabel({
        category: 'Materials',
        amount: 10,
        status: 'approved',
        subcategoryName: 'Cement',
        description: 'Steel - leftover',
      }),
      'Cement',
    )
    assert.equal(
      expenseSubcategoryLabel({
        category: 'Materials',
        amount: 10,
        status: 'approved',
        description: 'Steel delivery for villa',
      }),
      null,
    )
    assert.equal(
      expenseSubcategoryLabel({
        category: 'Materials',
        amount: 10,
        status: 'approved',
        description: 'Steel - TMT bars',
      }),
      'Steel',
    )
  })
})

describe('expenseLineLabels', () => {
  it('keeps custom description text after stripping a matching prefix', () => {
    assert.deepEqual(
      expenseLineLabels({
        category: 'Materials',
        amount: 10,
        status: 'approved',
        description: 'Cement - UltraTech bags',
      }),
      { subcategory: 'Cement', description: 'UltraTech bags' },
    )
  })
})

describe('buildExpenseDetailRows', () => {
  it('keeps exact rupee totals and custom subcategory names', () => {
    const rows = buildExpenseDetailRows(
      [
        {
          amount: 2391.5,
          category: 'Materials',
          status: 'approved',
          description: 'Cement - bags',
        },
        {
          amount: 100.25,
          category: 'Materials',
          status: 'approved',
          description: 'Steel delivery for villa',
        },
        {
          amount: 50,
          category: 'Materials',
          status: 'pending',
          subcategoryName: 'Villa special tiles',
        },
        {
          amount: 3127,
          category: 'Labour',
          status: 'approved',
          labourTeamName: 'Local Crew',
        },
      ],
      ['Materials', 'Labour', 'Equipment', 'Miscellaneous'],
    )

    const cement = rows.find((row) => row.subcategory === 'Cement')
    const unlabeled = rows.find(
      (row) => row.category === 'Materials' && row.subcategory === null,
    )
    const custom = rows.find((row) => row.subcategory === 'Villa special tiles')
    const labour = rows.find((row) => row.category === 'Labour')

    assert.equal(cement?.total, 2391.5)
    assert.equal(unlabeled?.total, 100.25)
    assert.equal(custom?.pending, 50)
    assert.equal(labour?.subcategory, 'Local Crew')
    assert.equal(labour?.total, 3127)
    assert.equal(
      rows.filter((row) => row.category === 'Materials').reduce((sum, row) => sum + row.total, 0),
      2541.75,
    )
  })
})
