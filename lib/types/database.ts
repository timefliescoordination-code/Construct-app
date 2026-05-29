// Database types matching the Supabase schema
export type UserRole = 'admin' | 'pm' | 'engineer' | 'customer'
export type ProjectStatus = 'active' | 'completed' | 'on-hold' | 'pending'
export type MilestoneStatus = 'completed' | 'in-progress' | 'pending'
export type ExpenseStatus = 'pending' | 'approved' | 'rejected'
export type PaymentStatus = 'pending' | 'received' | 'overdue'
export type VendorPaymentStatus = 'pending' | 'partial' | 'paid' | 'overdue'
export type AdditionalWorkStatus = 'pending' | 'approved' | 'rejected'

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

export interface Project {
  id: string
  name: string
  client_name: string
  site_address: string
  contract_value: number
  additional_works_value: number
  expected_margin_percent: number
  start_date: string | null
  expected_completion_date: string | null
  status: ProjectStatus
  pm_id: string | null
  customer_id: string | null
  created_at: string
  updated_at: string
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
