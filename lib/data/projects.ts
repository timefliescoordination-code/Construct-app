import { createClient } from "@/lib/supabase/server"
import type { 
  Project, 
  Milestone, 
  Expense, 
  ClientPayment, 
  VendorPayment, 
  AdditionalWork, 
  ProjectWithDetails,
  ProjectSummary,
  LabourType,
  LabourEntry
} from "@/lib/types/database"
import {
  calculateTotalContractValue,
  calculateCompletionPercent,
  calculateProjectedProfit,
  type MilestoneData
} from "@/lib/financial-calculations"
import { milestonesWithCalculatedExpenses } from "@/lib/project-tab-hydration"

// Fetch all projects (summary view)
export async function getProjects(): Promise<ProjectSummary[]> {
  const supabase = await createClient()
  
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      *,
      milestones(*),
      expenses(*),
      client_payments(*)
    `)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error('Error fetching projects:', error)
    return []
  }
  
  return (projects || []).map(project => {
    const totalExpenses = project.expenses
      ?.filter((e: Expense) => e.status === 'approved')
      .reduce((sum: number, e: Expense) => sum + Number(e.amount), 0) || 0
    
    const totalReceived = project.client_payments
      ?.filter((p: ClientPayment) => p.status === 'received')
      .reduce((sum: number, p: ClientPayment) => sum + Number(p.amount), 0) || 0
    
    const totalContractValue = calculateTotalContractValue(
      Number(project.contract_value), 
      Number(project.additional_works_value)
    )
    
    const enrichedMilestones = milestonesWithCalculatedExpenses({
      ...project,
      milestones: project.milestones || [],
      expenses: project.expenses || [],
    } as ProjectWithDetails)
    const milestonesForCalc: MilestoneData[] = enrichedMilestones.map((ms: Milestone) => ({
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: Number(ms.actual_completion_percent),
      targetBudget: Number(ms.target_budget),
      actualExpenses: Number(ms.actual_expenses),
      status: ms.status
    }))
    
    const progress = calculateCompletionPercent(milestonesForCalc)
    const profitLoss = calculateProjectedProfit(totalContractValue, totalExpenses)
    
    return {
      id: project.id,
      name: project.name,
      client_name: project.client_name,
      status: project.status,
      contract_value: totalContractValue,
      total_expenses: totalExpenses,
      total_received: totalReceived,
      progress,
      profit_loss: profitLoss
    }
  })
}

// Fetch single project with all details
export async function getProjectById(projectId: string): Promise<ProjectWithDetails | null> {
  const supabase = await createClient()
  
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      milestones(*),
      expenses(*),
      client_payments(*),
      vendor_payments(*),
      additional_works(*)
    `)
    .eq('id', projectId)
    .single()
  
  if (error) {
    console.error('Error fetching project:', error)
    return null
  }
  
  // Sort milestones by sort_order
  if (project.milestones) {
    project.milestones.sort((a: Milestone, b: Milestone) => a.sort_order - b.sort_order)
  }
  
  return project as ProjectWithDetails
}

// Fetch the default/first project (for consistent single project view)
export async function getDefaultProject(): Promise<ProjectWithDetails | null> {
  const supabase = await createClient()
  
  // Get the first project (our seed data project)
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      *,
      milestones(*),
      expenses(*),
      client_payments(*),
      vendor_payments(*),
      additional_works(*)
    `)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  
  if (error) {
    console.error('Error fetching default project:', error)
    return null
  }
  
  // Sort milestones by sort_order
  if (project.milestones) {
    project.milestones.sort((a: Milestone, b: Milestone) => a.sort_order - b.sort_order)
  }
  
  return project as ProjectWithDetails
}

// Fetch milestones for a project
export async function getMilestones(projectId: string): Promise<Milestone[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('sort_order', { ascending: true })
  
  if (error) {
    console.error('Error fetching milestones:', error)
    return []
  }
  
  return data || []
}

// Fetch expenses for a project
export async function getExpenses(projectId: string): Promise<Expense[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('project_id', projectId)
    .order('expense_date', { ascending: false })
  
  if (error) {
    console.error('Error fetching expenses:', error)
    return []
  }
  
  return data || []
}

// Fetch client payments for a project
export async function getClientPayments(projectId: string): Promise<ClientPayment[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('client_payments')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true })
  
  if (error) {
    console.error('Error fetching client payments:', error)
    return []
  }
  
  return data || []
}

// Fetch vendor payments for a project
export async function getVendorPayments(projectId: string): Promise<VendorPayment[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('vendor_payments')
    .select('*')
    .eq('project_id', projectId)
    .order('due_date', { ascending: true })
  
  if (error) {
    console.error('Error fetching vendor payments:', error)
    return []
  }
  
  return data || []
}

// Fetch additional works for a project
export async function getAdditionalWorks(projectId: string): Promise<AdditionalWork[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('additional_works')
    .select('*')
    .eq('project_id', projectId)
    .order('requested_date', { ascending: false })
  
  if (error) {
    console.error('Error fetching additional works:', error)
    return []
  }
  
  return data || []
}

// Fetch labour types
export async function getLabourTypes(): Promise<LabourType[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching labour types:', error)
    return []
  }
  
  return data || []
}

// Fetch labour entries for a project
export async function getLabourEntries(projectId: string): Promise<LabourEntry[]> {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .from('labour_entries')
    .select('*')
    .eq('project_id', projectId)
    .order('entry_date', { ascending: false })
  
  if (error) {
    console.error('Error fetching labour entries:', error)
    return []
  }
  
  return data || []
}

// Calculate aggregated project metrics
export function calculateProjectMetrics(project: ProjectWithDetails) {
  const totalExpenses = project.expenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  
  const totalClientPaymentsReceived = project.client_payments
    .filter(p => p.status === 'received')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  
  const totalClientPaymentsPending = project.client_payments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  
  const totalVendorPaymentsDue = project.vendor_payments
    .reduce((sum, vp) => sum + Number(vp.pending_amount), 0)
  
  const additionalWorksApproved = project.additional_works
    .filter(aw => aw.approval_status === 'approved')
    .reduce((sum, aw) => sum + Number(aw.amount), 0)
  
  const totalContractValue = calculateTotalContractValue(
    Number(project.contract_value), 
    additionalWorksApproved
  )
  
  const enrichedMilestones = milestonesWithCalculatedExpenses(project)
  const milestonesForCalc: MilestoneData[] = enrichedMilestones.map(ms => ({
    name: ms.name,
    expectedCostPercent: Number(ms.expected_cost_percent),
    actualCompletionPercent: Number(ms.actual_completion_percent),
    targetBudget: Number(ms.target_budget),
    actualExpenses: Number(ms.actual_expenses),
    status: ms.status
  }))
  
  const completionPercent = calculateCompletionPercent(milestonesForCalc)
  
  return {
    totalExpenses,
    totalClientPaymentsReceived,
    totalClientPaymentsPending,
    totalVendorPaymentsDue,
    additionalWorksApproved,
    totalContractValue,
    completionPercent
  }
}
