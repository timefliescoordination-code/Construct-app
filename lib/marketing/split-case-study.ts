export const EXPENSE_DISTRIBUTION_HEADING = '## Expense Distribution'

export function splitCaseStudyAroundExpenses(markdown: string): {
  before: string
  after: string
} {
  const headingMatch = markdown.match(/^## Expense Distribution[ \t]*$/m)
  if (!headingMatch || headingMatch.index == null) {
    return { before: markdown.trim(), after: '' }
  }
  const headingStart = headingMatch.index
  const afterHeading = markdown.slice(headingStart + headingMatch[0].length)
  const nextHeading = afterHeading.match(/^## /m)
  const afterStart =
    nextHeading?.index != null
      ? headingStart + headingMatch[0].length + nextHeading.index
      : markdown.length
  return {
    before: markdown.slice(0, headingStart).trim(),
    after: markdown.slice(afterStart).trim(),
  }
}
