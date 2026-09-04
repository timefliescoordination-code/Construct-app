import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  costBandFromRupees,
  durationBandFromDates,
  monthsBetweenDates,
  sizeBandFromSqft,
} from './bands.ts'

describe('sizeBandFromSqft', () => {
  it('maps the documented bands and omits missing values', () => {
    assert.equal(sizeBandFromSqft(1499), 'Under 1,500 sq.ft')
    assert.equal(sizeBandFromSqft(1500), '1,500–2,500 sq.ft')
    assert.equal(sizeBandFromSqft(2478), '1,500–2,500 sq.ft')
    assert.equal(sizeBandFromSqft(2500), '2,500–4,000 sq.ft')
    assert.equal(sizeBandFromSqft(4000), '4,000+ sq.ft')
    assert.equal(sizeBandFromSqft(0), undefined)
    assert.equal(sizeBandFromSqft(null), undefined)
  })
})

describe('costBandFromRupees', () => {
  it('maps lakh bands without exposing the exact rupee amount', () => {
    assert.equal(costBandFromRupees(4_872_319), 'Under ₹50 lakh')
    assert.equal(costBandFromRupees(5_000_000), '₹50–100 lakh')
    assert.equal(costBandFromRupees(10_000_000), '₹100–200 lakh')
    assert.equal(costBandFromRupees(20_000_000), '₹200 lakh+')
    assert.equal(costBandFromRupees(0), undefined)
    assert.equal(costBandFromRupees(null), undefined)
  })
})

describe('durationBandFromDates', () => {
  it('converts a reliable date span into a duration band', () => {
    assert.equal(monthsBetweenDates('2024-01-15', '2025-04-15'), 15)
    assert.equal(durationBandFromDates('2024-01-15', '2025-04-15'), '12–18 months')
    assert.equal(durationBandFromDates('2024-01-01', '2024-10-01'), 'Under 12 months')
    assert.equal(durationBandFromDates('2024-01-01', '2025-10-01'), '18–24 months')
    assert.equal(durationBandFromDates('2024-01-01', '2026-08-01'), '24+ months')
  })

  it('omits duration when dates are missing or invalid', () => {
    assert.equal(durationBandFromDates(null, '2025-04-15'), undefined)
    assert.equal(durationBandFromDates('2025-04-15', '2024-01-15'), undefined)
    assert.equal(durationBandFromDates('not-a-date', '2025-04-15'), undefined)
  })
})
