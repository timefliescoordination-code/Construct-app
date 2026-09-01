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
  proposal_default_notes?: string | null
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
  milestone_id: string | null
  stage_label: string | null
  created_at: string
  uploader?: Pick<Profile, 'id' | 'full_name'> | null
  milestone?: Pick<Milestone, 'id' | 'name'> | null
}

export type QualityApprovalStatus =
  | 'not_required'
  | 'pending'
  | 'failed'
  | 'awaiting_correction'
  | 'ready_for_approval'
  | 'approved'

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
  requires_quality_approval?: boolean
  quality_approval_status?: QualityApprovalStatus
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
  manpower_week_id?: string | null
  subcategory_name: string | null
  created_at: string
  updated_at: string
}

export interface LabourTeam {
  id: string
  project_id: string | null
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

export type AdditionalWorkStatus = 'pending' | 'approved' | 'rejected'

export type ChangeRequestCategory =
  | 'design'
  | 'material'
  | 'electrical'
  | 'plumbing'
  | 'civil_work'
  | 'finishing'
  | 'other'

export type ChangeRequestStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'costing_prepared'
  | 'internal_approval_pending'
  | 'customer_approval_pending'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export interface ConstructionChangeRequest {
  id: string
  project_id: string
  customer_id: string
  request_number: string
  title: string
  description: string
  category: ChangeRequestCategory
  related_milestone_id: string | null
  preferred_completion_date: string | null
  status: ChangeRequestStatus
  assigned_reviewer_id: string | null
  estimated_additional_days: number | null
  affected_milestone_id: string | null
  internal_notes: string | null
  customer_visible_explanation: string | null
  active_costing_revision_id: string | null
  additional_work_id: string | null
  client_payment_id: string | null
  submitted_at: string | null
  cancelled_at: string | null
  cancelled_by: string | null
  created_at: string
  updated_at: string
}

export interface ConstructionChangeAttachment {
  id: string
  change_request_id: string
  uploaded_by: string | null
  file_path: string
  file_name: string
  file_mime_type: string
  visibility: 'customer' | 'internal'
  created_at: string
}

export interface ConstructionChangeCostingRow {
  id: string
  revision_id: string
  line_order: number
  description: string
  unit: string
  price: number
}

export interface ConstructionChangeCostingRevision {
  id: string
  change_request_id: string
  revision_number: number
  author_id: string
  reason_for_change: string | null
  estimated_additional_days: number | null
  affected_milestone_id: string | null
  internal_notes: string | null
  customer_visible_explanation: string | null
  total_price: number
  created_at: string
  rows?: ConstructionChangeCostingRow[]
  author?: Profile | null
}

export interface ConstructionChangeAuditEvent {
  id: string
  change_request_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_id: string | null
  actor_role: string | null
  comments: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: Profile | null
}

export interface ConstructionChangeCustomerDecision {
  id: string
  change_request_id: string
  revision_id: string
  decision: 'accepted' | 'rejected'
  confirmation_text: string
  user_id: string
  created_at: string
}

export interface ConstructionChangeRequestDetail extends ConstructionChangeRequest {
  attachments: ConstructionChangeAttachment[]
  costing_revisions: ConstructionChangeCostingRevision[]
  audit_events: ConstructionChangeAuditEvent[]
  customer_decisions: ConstructionChangeCustomerDecision[]
  related_milestone?: Milestone | null
  affected_milestone?: Milestone | null
  project?: Pick<Project, 'id' | 'name' | 'customer_id' | 'pm_id'> | null
  customer?: Profile | null
  active_revision?: ConstructionChangeCostingRevision | null
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
  labour_team_id: string | null
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
  show_in_expense: boolean
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

export type QualityWorkType =
  | 'brickwork'
  | 'rcc'
  | 'foundation'
  | 'column'
  | 'beam'
  | 'slab'
  | 'plastering'
  | 'waterproofing'
  | 'flooring'
  | 'tiling'
  | 'painting'
  | 'plumbing'
  | 'electrical'
  | 'doors_windows'
  | 'external_works'
  | 'other'

export type QualityParameterType =
  | 'numeric'
  | 'ratio'
  | 'text'
  | 'single_select'
  | 'multi_select'
  | 'boolean'
  | 'measurement'

export type QualityItemStatus = 'pass' | 'fail' | 'na' | 'not_checked'

export type QualityInspectionStatus =
  | 'draft'
  | 'in_progress'
  | 'submitted'
  | 'failed'
  | 'awaiting_correction'
  | 'ready_for_reinspection'
  | 'approved'
  | 'rejected'
  | 'closed'

export type QualityCorrectiveStatus =
  | 'open'
  | 'in_progress'
  | 'ready_for_reinspection'
  | 'closed'

export type QualityPhotoLevel = 'inspection' | 'item' | 'failure'

export type QualityApprovalDecision = 'approved' | 'rejected' | 'request_correction'

export interface QualitySelectOption {
  value: string
  label: string
  result?: 'pass' | 'fail'
}

export interface QualityChecklistTemplate {
  id: string
  slug: string
  name: string
  description: string | null
  work_type: QualityWorkType
  version: number
  is_published: boolean
  requires_pm_approval: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QualityChecklistTemplateItem {
  id: string
  template_id: string
  category_name: string
  title: string
  description: string | null
  sort_order: number
  is_critical: boolean
  is_required: boolean
  allow_na: boolean
  created_at: string
  updated_at: string
}

export interface QualityChecklistTemplateParameter {
  id: string
  item_id: string
  name: string
  parameter_type: QualityParameterType
  unit: string | null
  requirement_label: string | null
  expected_value: string | null
  min_value: number | null
  max_value: number | null
  options: QualitySelectOption[]
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QualityChecklistTemplateItemWithParams extends QualityChecklistTemplateItem {
  parameters: QualityChecklistTemplateParameter[]
}

export interface QualityChecklistTemplateDetail extends QualityChecklistTemplate {
  items: QualityChecklistTemplateItemWithParams[]
}

export interface QualityProjectChecklist {
  id: string
  project_id: string
  milestone_id: string
  template_id: string
  template_version: number
  requires_pm_approval: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  template?: QualityChecklistTemplate | null
  milestone?: Pick<Milestone, 'id' | 'name'> | null
}

export interface QualityProjectParameterOverride {
  id: string
  project_id: string
  template_parameter_id: string
  requirement_label: string | null
  expected_value: string | null
  min_value: number | null
  max_value: number | null
  unit: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface QualityInspection {
  id: string
  project_id: string
  milestone_id: string
  template_id: string
  template_version: number
  inspection_number: number
  parent_inspection_id: string | null
  work_label: string
  location_label: string | null
  status: QualityInspectionStatus
  overall_result: 'pass' | 'fail' | null
  requires_pm_approval: boolean
  started_by: string | null
  submitted_by: string | null
  submitted_at: string | null
  locked_at: string | null
  created_at: string
  updated_at: string
}

export interface QualityInspectionItem {
  id: string
  inspection_id: string
  template_item_id: string | null
  category_name: string
  title: string
  description: string | null
  sort_order: number
  is_critical: boolean
  is_required: boolean
  allow_na: boolean
  status: QualityItemStatus
  remark: string | null
  created_at: string
  updated_at: string
}

export interface QualityInspectionParameterResult {
  id: string
  inspection_item_id: string
  template_parameter_id: string | null
  name: string
  parameter_type: QualityParameterType
  unit: string | null
  requirement_label: string | null
  expected_value: string | null
  min_value: number | null
  max_value: number | null
  options: QualitySelectOption[]
  actual_value: string | null
  actual_numeric: number | null
  status: QualityItemStatus
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QualityCorrectiveAction {
  id: string
  project_id: string
  inspection_id: string
  inspection_item_id: string
  remark: string | null
  corrective_action: string | null
  responsible_person_id: string | null
  target_date: string | null
  status: QualityCorrectiveStatus
  created_by: string | null
  created_at: string
  updated_at: string
  responsible_person?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface QualityInspectionPhoto {
  id: string
  project_id: string
  inspection_id: string
  inspection_item_id: string | null
  corrective_action_id: string | null
  level: QualityPhotoLevel
  file_path: string
  file_name: string
  file_mime_type: string
  uploaded_by: string | null
  created_at: string
  uploader?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface QualityInspectionApproval {
  id: string
  inspection_id: string
  decision: QualityApprovalDecision
  remark: string | null
  actor_id: string | null
  actor_role: string | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface QualityInspectionAuditEvent {
  id: string
  inspection_id: string
  event_type: string
  from_status: string | null
  to_status: string | null
  actor_id: string | null
  actor_role: string | null
  comments: string | null
  metadata: Record<string, unknown> | null
  created_at: string
  actor?: Pick<Profile, 'id' | 'full_name'> | null
}

export interface QualityInspectionItemDetail extends QualityInspectionItem {
  parameters: QualityInspectionParameterResult[]
  corrective_actions: QualityCorrectiveAction[]
  photos: QualityInspectionPhoto[]
}

export interface QualityInspectionDetail extends QualityInspection {
  items: QualityInspectionItemDetail[]
  photos: QualityInspectionPhoto[]
  approvals: QualityInspectionApproval[]
  audit_events: QualityInspectionAuditEvent[]
  project?: Pick<Project, 'id' | 'name' | 'pm_id'> | null
  milestone?: Pick<Milestone, 'id' | 'name' | 'status'> | null
  template?: Pick<QualityChecklistTemplate, 'id' | 'name' | 'work_type' | 'version'> | null
  starter?: Pick<Profile, 'id' | 'full_name'> | null
  submitter?: Pick<Profile, 'id' | 'full_name'> | null
  parent?: Pick<QualityInspection, 'id' | 'inspection_number' | 'status'> | null
}

export interface QualityInspectionListRow extends QualityInspection {
  project?: Pick<Project, 'id' | 'name'> | null
  milestone?: Pick<Milestone, 'id' | 'name'> | null
  starter?: Pick<Profile, 'id' | 'full_name'> | null
  failed_item_count?: number
  open_action_count?: number
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
