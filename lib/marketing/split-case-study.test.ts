import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { splitCaseStudyAroundExpenses } from './split-case-study.ts'

describe('splitCaseStudyAroundExpenses', () => {
  it('places the expense section between the article start and the remaining headings', () => {
    const markdown = `# Title

Intro paragraph.

## Project Overview

Overview text.

## Expense Distribution

Expense table.

## Construction Stages

Stage text.
`
    const split = splitCaseStudyAroundExpenses(markdown)
    assert.match(split.before, /# Title/)
    assert.match(split.before, /## Project Overview/)
    assert.equal(split.before.includes('Expense table'), false)
    assert.match(split.after, /## Construction Stages/)
    assert.equal(split.after.includes('Expense table'), false)
  })

  it('returns the full article before when there is no expense section', () => {
    const markdown = '# Title\n\nJust an article.\n'
    assert.deepEqual(splitCaseStudyAroundExpenses(markdown), {
      before: '# Title\n\nJust an article.',
      after: '',
    })
  })
})
