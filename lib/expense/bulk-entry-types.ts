export type BulkEntryVariant =
  | "project"
  | "engineer"
  | "company_expense"
  | "company_income"
  | "personal_expense"

export type ProjectBulkRow = {
  id: string
  date: string
  category: string
  subcategory: string
  labourTeamId: string
  milestoneId: string
  description: string
  amount: string
  vendor: string
}

export type EngineerBulkRow = {
  id: string
  category: string
  milestoneId: string
  description: string
  amount: string
  vendor: string
}

export type CompanyExpenseBulkRow = {
  id: string
  date: string
  category: string
  description: string
  amount: string
  vendor: string
}

export type CompanyIncomeBulkRow = {
  id: string
  date: string
  category: string
  description: string
  amount: string
  source: string
}

export type PersonalExpenseBulkRow = {
  id: string
  date: string
  category: string
  description: string
  amount: string
}

export type BulkCompletedRow =
  | { variant: "project"; row: ProjectBulkRow }
  | { variant: "engineer"; row: EngineerBulkRow }
  | { variant: "company_expense"; row: CompanyExpenseBulkRow }
  | { variant: "company_income"; row: CompanyIncomeBulkRow }
  | { variant: "personal_expense"; row: PersonalExpenseBulkRow }

export function newRowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}
