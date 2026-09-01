import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateParameterStatus, parseRatio, ratiosEqual } from './validation.ts'

describe('quality parameter validation', () => {
  it('passes a measurement inside min/max', () => {
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'measurement',
        actual_value: '11',
        min_value: 10,
        max_value: 12,
      }),
      'pass',
    )
  })

  it('fails a measurement above max', () => {
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'measurement',
        actual_value: '14 mm',
        max_value: 12,
      }),
      'fail',
    )
  })

  it('fails a measurement below min', () => {
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'numeric',
        actual_value: '90',
        min_value: 100,
      }),
      'fail',
    )
  })

  it('compares mortar ratios ignoring spaces', () => {
    assert.equal(Boolean(parseRatio('1 : 6')), true)
    assert.equal(ratiosEqual('1:6', '1 : 6'), true)
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'ratio',
        actual_value: '1 : 6',
        expected_value: '1:6',
      }),
      'pass',
    )
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'ratio',
        actual_value: '1:5',
        expected_value: '1:6',
      }),
      'fail',
    )
  })

  it('uses select option result when present', () => {
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'single_select',
        actual_value: 'too_dry',
        options: [
          { value: 'proper', label: 'Proper', result: 'pass' },
          { value: 'too_dry', label: 'Too dry', result: 'fail' },
        ],
      }),
      'fail',
    )
  })

  it('evaluates boolean against expected yes', () => {
    assert.equal(
      evaluateParameterStatus({
        parameter_type: 'boolean',
        actual_value: 'no',
        expected_value: 'yes',
      }),
      'fail',
    )
  })
})
