import type {
  CompanyExpenseBulkRow,
  CompanyIncomeBulkRow,
  PersonalExpenseBulkRow,
} from "@/lib/expense/bulk-entry-types"

export function emptyCompanyExpenseRow(date: string, category = ""): CompanyExpenseBulkRow {
  return { id: "", date, category, description: "", amount: "", vendor: "" }
}

export function carryForwardCompanyExpenseRow(
  prev: CompanyExpenseBulkRow,
): CompanyExpenseBulkRow {
  return {
    ...emptyCompanyExpenseRow(prev.date, prev.category),
    date: prev.date,
    category: prev.category,
  }
}

export function emptyCompanyIncomeRow(date: string, category = ""): CompanyIncomeBulkRow {
  return { id: "", date, category, description: "", amount: "", source: "" }
}

export function carryForwardCompanyIncomeRow(
  prev: CompanyIncomeBulkRow,
): CompanyIncomeBulkRow {
  return {
    ...emptyCompanyIncomeRow(prev.date, prev.category),
    date: prev.date,
    category: prev.category,
  }
}

export function emptyPersonalExpenseRow(date: string, category = ""): PersonalExpenseBulkRow {
  return { id: "", date, category, description: "", amount: "" }
}

export function carryForwardPersonalExpenseRow(
  prev: PersonalExpenseBulkRow,
): PersonalExpenseBulkRow {
  return {
    ...emptyPersonalExpenseRow(prev.date, prev.category),
    date: prev.date,
    category: prev.category,
  }
}

function parseAmount(amount: string): number | null {
  const n = Number(amount)
  return Number.isFinite(n) && n >= 0 ? n : null
}

export function validateCompanyExpenseRow(row: CompanyExpenseBulkRow, label: string) {
  if (!row.category) return `${label}: select category`
  if (!row.description.trim()) return `${label}: enter description`
  if (parseAmount(row.amount) === null) return `${label}: enter valid amount`
  return null
}

export function validateCompanyIncomeRow(row: CompanyIncomeBulkRow, label: string) {
  if (!row.category) return `${label}: select category`
  if (!row.description.trim()) return `${label}: enter description`
  if (parseAmount(row.amount) === null) return `${label}: enter valid amount`
  return null
}

export function validatePersonalExpenseRow(row: PersonalExpenseBulkRow, label: string) {
  if (!row.category) return `${label}: select category`
  if (!row.description.trim()) return `${label}: enter description`
  if (parseAmount(row.amount) === null) return `${label}: enter valid amount`
  return null
}
