import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types/database'
import { canExportCompanyPersonal } from '@/lib/expense/export/permissions'
import {
  matchesSubcategoryFilter,
  matchesVendorFilter,
  parseExpenseSubcategory,
} from '@/lib/expense/export/parse'
import type {
  ExpenseExportFilters,
  ExpenseExportType,
  ExportExpenseRow,
} from '@/lib/expense/export/types'
import { EXPORT_MAX_ROWS, EXPORT_PAGE_SIZE } from '@/lib/expense/export/types'

type ProfileRef = { full_name: string | null } | null

type ProjectExpenseRow = {
  id: string
  project_id: string
  milestone_id: string | null
  category: string
  description: string
  amount: number
  vendor_name: string | null
  bill_number: string | null
  expense_date: string
  status: string
  entered_by: string | null
  submitted_by: string | null
  approved_by: string | null
  labour_team_id: string | null
  split_group_id: string | null
  split_number: number | null
  created_at: string
  updated_at: string
  project: { id: string; name: string } | { id: string; name: string }[] | null
  milestone: { id: string; name: string } | null
  labour_team: { id: string; name: string } | null
  split_group: { subcategory_name: string | null } | null
  entered_by_profile: ProfileRef
  submitted_by_profile: ProfileRef
  approved_by_profile: ProfileRef
  expense_invoices:
    | Array<{
        file_name: string
        invoice_number: string | null
        invoice_total: number | null
      }>
    | null
}

type CompanyExpenseRow = {
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
  created_by_profile: ProfileRef
}

type PersonalExpenseRow = {
  id: string
  category: string
  description: string
  amount: number
  expense_date: string
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  created_by_profile: ProfileRef
}

function unwrapOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function profileName(profile: ProfileRef): string | null {
  return profile?.full_name?.trim() || null
}

function formatDateOnly(value: string): string {
  return value.slice(0, 10)
}

function mapProjectExpense(
  row: ProjectExpenseRow,
  splitSubcategory: string | null,
): Omit<ExportExpenseRow, 'serialNumber'> {
  const parsed = parseExpenseSubcategory(row.description)
  const subcategory = splitSubcategory ?? parsed.subcategory
  const description = splitSubcategory ? row.description : parsed.description
  const project = unwrapOne(row.project)
  const invoice = row.expense_invoices?.[0] ?? null
  const amount = Number(row.amount)

  return {
    expenseId: row.id,
    referenceNumber: row.bill_number,
    expenseDate: formatDateOnly(row.expense_date),
    createdDate: formatDateOnly(row.created_at),
    expenseType: 'project',
    projectId: row.project_id,
    projectName: project?.name ?? null,
    category: row.category,
    subcategory,
    description,
    vendorPayee: row.vendor_name,
    paymentMethod: null,
    paymentStatus: row.status,
    amount,
    taxGst: null,
    totalAmount: amount,
    notes: null,
    createdBy: profileName(row.entered_by_profile),
    enteredBy: profileName(row.entered_by_profile),
    submittedBy: profileName(row.submitted_by_profile),
    approvedBy: profileName(row.approved_by_profile),
    milestoneName: row.milestone?.name ?? null,
    labourTeamName: row.labour_team?.name ?? null,
    billNumber: row.bill_number,
    splitGroupId: row.split_group_id,
    splitNumber: row.split_number,
    invoiceFileName: invoice?.file_name ?? null,
    invoiceNumber: invoice?.invoice_number ?? null,
    invoiceTotal:
      invoice?.invoice_total != null ? Number(invoice.invoice_total) : null,
    updatedAt: row.updated_at,
  }
}

function mapCompanyExpense(row: CompanyExpenseRow): Omit<ExportExpenseRow, 'serialNumber'> {
  const amount = Number(row.amount)
  return {
    expenseId: row.id,
    referenceNumber: null,
    expenseDate: formatDateOnly(row.expense_date),
    createdDate: formatDateOnly(row.created_at),
    expenseType: 'company',
    projectId: null,
    projectName: null,
    category: row.category,
    subcategory: null,
    description: row.description,
    vendorPayee: row.vendor_name,
    paymentMethod: row.payment_method,
    paymentStatus: 'recorded',
    amount,
    taxGst: null,
    totalAmount: amount,
    notes: row.notes,
    createdBy: profileName(row.created_by_profile),
    enteredBy: null,
    submittedBy: null,
    approvedBy: null,
    milestoneName: null,
    labourTeamName: null,
    billNumber: null,
    splitGroupId: null,
    splitNumber: null,
    invoiceFileName: null,
    invoiceNumber: null,
    invoiceTotal: null,
    updatedAt: row.updated_at,
  }
}

function mapPersonalExpense(row: PersonalExpenseRow): Omit<ExportExpenseRow, 'serialNumber'> {
  const amount = Number(row.amount)
  return {
    expenseId: row.id,
    referenceNumber: null,
    expenseDate: formatDateOnly(row.expense_date),
    createdDate: formatDateOnly(row.created_at),
    expenseType: 'personal',
    projectId: null,
    projectName: null,
    category: row.category,
    subcategory: null,
    description: row.description,
    vendorPayee: null,
    paymentMethod: null,
    paymentStatus: 'recorded',
    amount,
    taxGst: null,
    totalAmount: amount,
    notes: row.notes,
    createdBy: profileName(row.created_by_profile),
    enteredBy: null,
    submittedBy: null,
    approvedBy: null,
    milestoneName: null,
    labourTeamName: null,
    billNumber: null,
    splitGroupId: null,
    splitNumber: null,
    invoiceFileName: null,
    invoiceNumber: null,
    invoiceTotal: null,
    updatedAt: row.updated_at,
  }
}

function shouldIncludeType(
  filters: ExpenseExportFilters,
  type: ExpenseExportType,
): boolean {
  if (filters.expenseType === 'all' || !filters.expenseType) return true
  return filters.expenseType === type
}

function applyClientFilters(
  rows: Omit<ExportExpenseRow, 'serialNumber'>[],
  filters: ExpenseExportFilters,
): Omit<ExportExpenseRow, 'serialNumber'>[] {
  if (filters.allExpenses) return rows

  return rows.filter((row) => {
    if (filters.subcategory && !matchesSubcategoryFilter(row.subcategory, filters.subcategory)) {
      return false
    }
    if (!matchesVendorFilter(row.vendorPayee, filters.vendor)) return false
    return true
  })
}

function withSerialNumbers(
  rows: Omit<ExportExpenseRow, 'serialNumber'>[],
): ExportExpenseRow[] {
  return rows.map((row, index) => ({ ...row, serialNumber: index + 1 }))
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  let from = 0

  while (all.length < EXPORT_MAX_ROWS) {
    const to = from + EXPORT_PAGE_SIZE - 1
    const { data, error } = await fetchPage(from, to)
    if (error) throw error
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < EXPORT_PAGE_SIZE) break
    from += EXPORT_PAGE_SIZE
  }

  return all.slice(0, EXPORT_MAX_ROWS)
}

export async function fetchExportableExpenses(
  supabase: SupabaseClient,
  role: UserRole,
  filters: ExpenseExportFilters,
): Promise<ExportExpenseRow[]> {
  const rows: Omit<ExportExpenseRow, 'serialNumber'>[] = []
  const includeProject = shouldIncludeType(filters, 'project')
  const includeCompany = canExportCompanyPersonal(role) && shouldIncludeType(filters, 'company')
  const includePersonal = canExportCompanyPersonal(role) && shouldIncludeType(filters, 'personal')

  if (includeProject) {
    const projectRows = await fetchAllPages<ProjectExpenseRow>(async (from, to) => {
      let query = supabase
        .from('expenses')
        .select(
          `
          *,
          project:projects(id, name),
          milestone:milestones(id, name),
          labour_team:labour_teams(id, name),
          split_group:expense_split_groups(subcategory_name),
          entered_by_profile:profiles!expenses_entered_by_fkey(full_name),
          submitted_by_profile:profiles!expenses_submitted_by_fkey(full_name),
          approved_by_profile:profiles!expenses_approved_by_fkey(full_name),
          expense_invoices(file_name, invoice_number, invoice_total)
        `,
        )
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false })

      if (!filters.allExpenses) {
        if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
        if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)
        if (filters.projectId) query = query.eq('project_id', filters.projectId)
        if (filters.category) query = query.eq('category', filters.category)
        if (filters.paymentStatus) query = query.eq('status', filters.paymentStatus)
        if (filters.createdBy) query = query.eq('entered_by', filters.createdBy)
      }

      return query.range(from, to)
    })

    for (const row of projectRows) {
      rows.push(
        mapProjectExpense(row, row.split_group?.subcategory_name ?? null),
      )
    }
  }

  if (includeCompany) {
    const companyRows = await fetchAllPages<CompanyExpenseRow>(async (from, to) => {
      let query = supabase
        .from('company_expenses')
        .select(
          `
          *,
          created_by_profile:profiles!company_expenses_created_by_fkey(full_name)
        `,
        )
        .order('expense_date', { ascending: false })

      if (!filters.allExpenses) {
        if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
        if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)
        if (filters.category) query = query.eq('category', filters.category)
        if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
      }

      return query.range(from, to)
    })

    rows.push(...companyRows.map(mapCompanyExpense))
  }

  if (includePersonal) {
    const personalRows = await fetchAllPages<PersonalExpenseRow>(async (from, to) => {
      let query = supabase
        .from('personal_expenses')
        .select(
          `
          *,
          created_by_profile:profiles!personal_expenses_created_by_fkey(full_name)
        `,
        )
        .order('expense_date', { ascending: false })

      if (!filters.allExpenses) {
        if (filters.dateFrom) query = query.gte('expense_date', filters.dateFrom)
        if (filters.dateTo) query = query.lte('expense_date', filters.dateTo)
        if (filters.category) query = query.eq('category', filters.category)
        if (filters.createdBy) query = query.eq('created_by', filters.createdBy)
      }

      return query.range(from, to)
    })

    rows.push(...personalRows.map(mapPersonalExpense))
  }

  const filtered = applyClientFilters(rows, filters)
  filtered.sort((a, b) => {
    const dateCmp = b.expenseDate.localeCompare(a.expenseDate)
    if (dateCmp !== 0) return dateCmp
    return b.createdDate.localeCompare(a.createdDate)
  })

  return withSerialNumbers(filtered)
}

export async function fetchExportFilterOptions(
  supabase: SupabaseClient,
  role: UserRole,
  projectId?: string,
) {
  let projectsQuery = supabase
    .from('projects')
    .select('id, name')
    .neq('status', 'archived')
    .order('name')

  if (projectId) {
    projectsQuery = projectsQuery.eq('id', projectId)
  }

  const [projectsResult, profilesResult] = await Promise.all([
    projectsQuery,
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'pm', 'engineer']),
  ])

  const categories = new Set<string>()
  if (projectId) {
    const { data } = await supabase
      .from('expense_categories')
      .select('name, expense_subcategories(name)')
      .eq('project_id', projectId)
    for (const cat of data ?? []) {
      categories.add(cat.name)
    }
  }

  return {
    projects: projectsResult.data ?? [],
    profiles: profilesResult.data ?? [],
    categories: [...categories],
    canExportCompany: canExportCompanyPersonal(role),
    canExportPersonal: canExportCompanyPersonal(role),
  }
}
