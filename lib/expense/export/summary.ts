import type { ExportExpenseRow } from './types.ts'

export function summarizeExportRows(rows: ExportExpenseRow[]) {
  const byProject = new Map<string, { total: number; count: number }>()
  const byCategory = new Map<string, { total: number; count: number }>()

  for (const row of rows) {
    if (row.projectName) {
      const current = byProject.get(row.projectName) ?? { total: 0, count: 0 }
      current.total += row.totalAmount
      current.count += 1
      byProject.set(row.projectName, current)
    }

    const categoryKey = row.category || 'Uncategorized'
    const cat = byCategory.get(categoryKey) ?? { total: 0, count: 0 }
    cat.total += row.totalAmount
    cat.count += 1
    byCategory.set(categoryKey, cat)
  }

  return {
    byProject: [...byProject.entries()]
      .map(([projectName, value]) => ({ projectName, ...value }))
      .sort((a, b) => b.total - a.total),
    byCategory: [...byCategory.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.total - a.total),
  }
}
