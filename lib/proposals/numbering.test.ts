import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { formatProposalNumber, proposalSeriesNumber } from './constants.ts'

describe('formatProposalNumber', () => {
  it('adds the version after a slash from the first version', () => {
    assert.equal(formatProposalNumber('VRA-106', 1), 'VRA-106/1')
    assert.equal(formatProposalNumber('VRA-106', 2), 'VRA-106/2')
  })

  it('defaults to version 1', () => {
    assert.equal(formatProposalNumber('VRA-106'), 'VRA-106/1')
    assert.equal(formatProposalNumber('VRA-106', null), 'VRA-106/1')
  })

  it('does not double the version suffix', () => {
    assert.equal(formatProposalNumber('VRA-106/1', 3), 'VRA-106/3')
  })
})

describe('proposalSeriesNumber', () => {
  it('strips a version suffix', () => {
    assert.equal(proposalSeriesNumber('VRA-106/2'), 'VRA-106')
    assert.equal(proposalSeriesNumber('VRA-106'), 'VRA-106')
  })
})
