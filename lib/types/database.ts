// Database types matching the Supabase schema
export type UserRole = 'admin' | 'pm' | 'engineer' | 'customer'
export type ProjectLifecyclePhase = 'design' | 'construction'
export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'pending' | 'archived'
export type MilestoneStatus = 'completed' | 'in-progress' | 'pending'
export type ExpenseStatus = 'pending' | 'approved' | 'rejected'
export type PaymentStatus = 'pending' | 'received' | 'overdue'
export type VendorPaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue'
export type AdditionalWorkStatus = 'pending' | 'approved' | 'rejected'
export type InvoiceProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  company_name: string | null
  created_at: string
  updated_at: string
}

export interface CompanySettings {
  id: string
  company_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  website: string | null
  logo_path: string | null
  updated_at: string
  updated_by: string | null
}

export interface Project {
  id: string
  name: string
  client_name: string
  site_address: string
  client_phone: string | null
  contract_value: number
  additional_works_value: number
  expected_margin_percent: number
  start_date: string | null
  expected_completion_date: string | null
  status: ProjectStatus
  lifecycle_phase: ProjectLifecyclePhase
  construction_activated_at: string | null
  construction_activated_by: string | null
  pm_id: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
}

export interface ProjectDesignFile {
  id: string
  project_id: string
  file_path: string
  file_name: string
  file_mime_type: string
  title: string
  revision_label: string | null
  uploaded_by: string | null
  created_at: string
}

export interface ProjectDesignComment {
  id: string
  design_file_id: string
  author_id: string
  body: string
  created_at: string
}

export interface ProjectDesignFileWithComments extends ProjectDesignFile {
  comments: (ProjectDesignComment & { author?: Profile | null })[]
  uploader?: Profile | null
}

export interface ProjectSitePhoto {
  id: string
  project_id: string
  upload_batch_id: string
  file_path: string
  file_name: string
  file_mime_type: string
  caption: string | null
  uploaded_by: string | null
  company_name: string | null
  company_phone: string | null
  created_at: string
  uploader?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface Milestone {
  id: string
  project_id: string
  name: string
  expected_cost_percent: number
  target_budget: number
  actual_expenses: number
  actual_completion_percent: number
  expected_duration: string | null
  status: MilestoneStatus
  sort_order: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Expense {
  id: string
  project_id: string
  milestone_id: string | null
  category: string
  description: string
  amount: number
  vendor_name: string | null
  bill_number: string | null
  expense_date: string
  labour_team_id: string | null
  split_group_id: string | null
  split_number: number | null
  status: ExpenseStatus
  submitted_by: string | null
  approved_by: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseSplitGroup {
  id: string
  project_id: string
  total_amount: number
  category: string
  description: string
  vendor_name: string | null
  bill_number: string | null
  milestone_id: string | null
  labour_team_id: string | null
  subcategory_name: string | null
  created_at: string
  updated_at: string
}

export interface LabourTeam {
  id: string
  project_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface ClientPayment {
  id: string
  project_id: string
  milestone_id: string | null
  stage_name: string
  amount: number
  due_date: string | null
  received_date: string | null
  status: PaymentStatus
  payment_method: string | null
  reference_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface VendorPayment {
  id: string
  project_id: string
  vendor_name: string
  total_amount: number
  amount_paid: number
  pending_amount: number
  due_date: string | null
  status: VendorPaymentStatus
  category: string | null
  notes: string | null
  expense_split_group_id?: string | null
  created_at: string
  updated_at: string
}

export interface AdditionalWork {
  id: string
  project_id: string
  description: string
  amount: number
  requested_date: string
  approval_status: AdditionalWorkStatus
  approved_by: string | null
  approved_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LabourType {
  id: string
  project_id: string | null
  name: string
  short_label: string | null
  default_wage: number
  sort_order: number
  created_at: string
}

export interface ManpowerWeek {
  id: string
  project_id: string
  milestone_id: string
  week_number: number
  start_date: string
  created_at: string
  updated_at: string
}

export interface ManpowerWeekRate {
  id: string
  week_id: string
  labour_type_id: string
  daily_rate: number
}

export interface LabourEntry {
  id: string
  project_id: string
  milestone_id: string | null
  labour_type_id: string
  entry_date: string
  count: number
  wage_per_person: number
  total_cost: number
  submitted_by: string | null
  created_at: string
  updated_at: string
}

export interface ExpenseInvoice {
  id: string
  expense_id: string
  file_path: string
  file_name: string
  file_mime_type: string
  vendor_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  invoice_total: number | null
  processing_status: InvoiceProcessingStatus
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  expense_id: string
  material_description_original: string
  material_description_standardized: string | null
  quantity: number | null
  unit: string | null
  unit_rate: number | null
  total_amount: number
  created_at: string
}

export interface ExpenseInvoiceWithItems extends ExpenseInvoice {
  items: InvoiceItem[]
}

export interface CompanyExpense {
  id: string
  category: string
  description: string
  amount: number
  vendor_name: string | null
  expense_date: string
  payment_method: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CompanyIncome {
  id: string
  category: string
  description: string
  amount: number
  source_name: string | null
  received_date: string
  payment_method: string | null
  reference_number: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export type FinanceCategoryKind =
  | "company_expense"
  | "company_income"
  | "personal_expense"

export interface FinanceCategory {
  id: string
  kind: FinanceCategoryKind
  name: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface PersonalExpense {
  id: string
  category: string
  description: string
  amount: number
  expense_date: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ProjectEngineerAssignment {
  engineer_id: string
  engineer?: Profile | null
}

// Joined types for queries
export interface ProjectWithDetails extends Project {
  milestones: Milestone[]
  expenses: Expense[]
  client_payments: ClientPayment[]
  vendor_payments: VendorPayment[]
  additional_works: AdditionalWork[]
  pm?: Profile | null
  customer?: Profile | null
  project_engineers?: ProjectEngineerAssignment[]
  /** Sum of labour_entries.count for the server’s current calendar day (engineer dashboard). */
  labour_workers_today?: number
}

// Summary types for dashboard views
export interface ProjectSummary {
  id: string
  name: string
  client_name: string
  status: ProjectStatus
  contract_value: number
  total_expenses: number
  total_received: number
  progress: number
  profit_loss: number
}
