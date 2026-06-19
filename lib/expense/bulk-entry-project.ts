import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
import type { BulkCreateExpenseRow } from "@/lib/projects/tab-actions"
import type { ProjectBulkRow } from "@/lib/expense/bulk-entry-types"

export function categoryUsesLabourTeams(
  categoryName: string,
  categories: ExpenseCategoryView[],
) {
  const match = categories.find((c) => c.name === categoryName)
  if (match) return match.usesLabourTeams
  return categoryName.trim().toLowerCase() === "labour"
}

export function toExpenseDescription(subcategory: string, description: string) {
  return subcategory ? `${subcategory} - ${description}` : description
}

export function emptyProjectBulkRow(date: string): ProjectBulkRow {
  return {
    id: "",
    date,
    category: "",
    subcategory: "",
    labourTeamId: "",
    milestoneId: "",
    description: "",
    amount: "",
    vendor: "",
  }
}

export function carryForwardProjectRow(prev: ProjectBulkRow): ProjectBulkRow {
  return {
    ...emptyProjectBulkRow(prev.date),
    date: prev.date,
    category: prev.category,
    subcategory: prev.subcategory,
    labourTeamId: prev.labourTeamId,
    milestoneId: prev.milestoneId,
  }
}

export function validateProjectBulkRow(
  row: ProjectBulkRow,
  expenseCategories: ExpenseCategoryView[],
  milestoneCount: number,
  rowLabel: string,
): string | null {
  if (!row.category) return `${rowLabel}: select category`
  const usesLabour = categoryUsesLabourTeams(row.category, expenseCategories)
  if (usesLabour && !row.labourTeamId) {
    return `${rowLabel}: select labour team`
  }
  if (!usesLabour && !row.subcategory) {
    return `${rowLabel}: select subcategory`
  }
  if (!row.description.trim()) return `${rowLabel}: enter description`
  if (milestoneCount > 0 && !row.milestoneId) {
    return `${rowLabel}: select stage/milestone`
  }
  const amount = parseFloat(row.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return `${rowLabel}: enter a valid amount`
  }
  return null
}

export function mapProjectBulkRowToCreate(
  row: ProjectBulkRow,
  expenseCategories: ExpenseCategoryView[],
  labourTeamNameById: Map<string, string>,
  status: "approved" | "pending",
): BulkCreateExpenseRow {
  const usesLabour = categoryUsesLabourTeams(row.category, expenseCategories)
  const teamName = labourTeamNameById.get(row.labourTeamId)
  const description = usesLabour
    ? row.description.trim()
    : toExpenseDescription(row.subcategory, row.description.trim())
  const fullDescription = teamName ? `${teamName} - ${description}` : description

  return {
    milestoneId: row.milestoneId || null,
    category: row.category,
    description: fullDescription,
    amount: parseFloat(row.amount),
    vendorName: row.vendor.trim() || null,
    billNumber: null,
    expenseDate: row.date,
    labourTeamId: usesLabour ? row.labourTeamId : null,
    status,
  }
}
