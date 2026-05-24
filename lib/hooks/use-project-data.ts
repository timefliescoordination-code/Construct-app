"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { 
  Project, 
  Milestone, 
  Expense, 
  ClientPayment, 
  VendorPayment, 
  AdditionalWork, 
  ProjectWithDetails,
  LabourType,
  LabourEntry
} from "@/lib/types/database"
import {
  calculateTotalContractValue,
  calculateCompletionPercent,
  calculateProjectedProfit,
  type MilestoneData
} from "@/lib/financial-calculations"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import { getProjectPmLabel, getProjectEngineersLabel } from "@/lib/staff-labels"

function getSupabase() {
  return createClient()
}

const PROJECT_STAFF_SELECT = `
  *,
  milestones(*),
  expenses(*),
  client_payments(*),
  pm:profiles!pm_id(id, email, full_name, role, phone, company_name, created_at, updated_at),
  project_engineers(
    engineer_id,
    engineer:profiles!engineer_id(id, email, full_name, role, phone, company_name, created_at, updated_at)
  )
`

const PROJECT_DETAIL_SELECT = `
  ${PROJECT_STAFF_SELECT.trim()},
  vendor_payments(*),
  additional_works(*)
`

// Fetch all projects
async function fetchProjects() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_STAFF_SELECT)
    .order('created_at', { ascending: false })
  
  if (error) {
    console.error("[v0] fetchProjects error:", error.message ?? error.code ?? error)
    throw new Error(getSupabaseErrorMessage(error))
  }
  return data || []
}

// Fetch single project with all details
async function fetchProject(projectId: string) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_DETAIL_SELECT)
    .eq('id', projectId)
    .single()
  
  if (error) throw error
  
  // Sort milestones by sort_order
  if (data.milestones) {
    data.milestones.sort((a: Milestone, b: Milestone) => a.sort_order - b.sort_order)
  }
  
  return data as ProjectWithDetails
}

// Fetch the default/first project
async function fetchDefaultProject() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('projects')
    .select(PROJECT_DETAIL_SELECT)
    .order('created_at', { ascending: true })
    .limit(1)
    .single()
  
  if (error) throw error
  
  // Sort milestones by sort_order
  if (data.milestones) {
    data.milestones.sort((a: Milestone, b: Milestone) => a.sort_order - b.sort_order)
  }
  
  return data as ProjectWithDetails
}

// Fetch labour types
async function fetchLabourTypes() {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('labour_types')
    .select('*')
    .order('name', { ascending: true })
  
  if (error) throw error
  return data as LabourType[]
}

const swrDefaults = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
}

// Hook: Get all projects
export function useProjects() {
  const { data, error, isLoading, mutate } = useSWR('projects', fetchProjects, swrDefaults)
  
  const projectSummaries = (data || []).map(project => {
    const totalExpenses = project.expenses
      ?.filter((e: Expense) => e.status === 'approved')
      .reduce((sum: number, e: Expense) => sum + Number(e.amount), 0) || 0
    
    const totalReceived = project.client_payments
      ?.filter((p: ClientPayment) => p.status === 'received')
      .reduce((sum: number, p: ClientPayment) => sum + Number(p.amount), 0) || 0
    
    const additionalWorksApproved = project.additional_works
      ?.filter((aw: AdditionalWork) => aw.approval_status === 'approved')
      .reduce((sum: number, aw: AdditionalWork) => sum + Number(aw.amount), 0) || 0
    
    const totalContractValue = calculateTotalContractValue(
      Number(project.contract_value), 
      additionalWorksApproved
    )
    
    const milestonesForCalc: MilestoneData[] = (project.milestones || []).map((ms: Milestone) => ({
      name: ms.name,
      expectedCostPercent: Number(ms.expected_cost_percent),
      actualCompletionPercent: ms.actual_completion_percent,
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
      site_address: project.site_address,
      status: project.status,
      contract_value: totalContractValue,
      total_expenses: totalExpenses,
      total_received: totalReceived,
      progress,
      profit_loss: profitLoss,
      start_date: project.start_date,
      expected_completion_date: project.expected_completion_date,
      pm_label: getProjectPmLabel(project),
      site_engineers_label: getProjectEngineersLabel(project),
    }
  })
  
  return {
    projects: projectSummaries,
    isLoading,
    error,
    mutate
  }
}

// Hook: Get single project with all details
export function useProject(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `project-${projectId}` : null,
    () => projectId ? fetchProject(projectId) : null,
    swrDefaults,
  )
  
  // Calculate actual expenses per milestone from expenses
  const projectWithCalculatedExpenses = data ? {
    ...data,
    milestones: data.milestones.map(ms => {
      const milestoneExpenses = data.expenses
        .filter(exp => exp.milestone_id === ms.id && exp.status === 'approved')
        .reduce((sum, exp) => sum + Number(exp.amount), 0)
      return {
        ...ms,
        actual_expenses: milestoneExpenses
      }
    })
  } : null
  
  return {
    project: projectWithCalculatedExpenses,
    isLoading,
    error,
    mutate
  }
}

// Hook: Get default project
export function useDefaultProject(enabled = true) {
  const { data, error, isLoading, mutate } = useSWR(
    enabled ? 'default-project' : null,
    fetchDefaultProject,
    swrDefaults,
  )
  
  // Calculate actual expenses per milestone from expenses
  const projectWithCalculatedExpenses = data ? {
    ...data,
    milestones: data.milestones.map(ms => {
      const milestoneExpenses = data.expenses
        .filter(exp => exp.milestone_id === ms.id && exp.status === 'approved')
        .reduce((sum, exp) => sum + Number(exp.amount), 0)
      return {
        ...ms,
        actual_expenses: milestoneExpenses
      }
    })
  } : null
  
  return {
    project: projectWithCalculatedExpenses,
    isLoading,
    error,
    mutate
  }
}

// Hook: Get labour types
export function useLabourTypes() {
  const { data, error, isLoading } = useSWR('labour-types', fetchLabourTypes)
  
  return {
    labourTypes: data || [],
    isLoading,
    error
  }
}

// Hook: Calculate project metrics from project data
export function useProjectMetrics(project: ProjectWithDetails | null) {
  if (!project) {
    return {
      totalExpenses: 0,
      totalClientPaymentsReceived: 0,
      totalClientPaymentsPending: 0,
      totalVendorPaymentsDue: 0,
      additionalWorksApproved: 0,
      totalContractValue: 0,
      completionPercent: 0,
      expectedProfitPercent: 0,
      cashflowBalance: 0
    }
  }
  
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
  
  const milestonesForCalc: MilestoneData[] = project.milestones.map(ms => ({
    name: ms.name,
    expectedCostPercent: Number(ms.expected_cost_percent),
    actualCompletionPercent: ms.actual_completion_percent,
    targetBudget: Number(ms.target_budget),
    actualExpenses: Number(ms.actual_expenses),
    status: ms.status
  }))
  
  const completionPercent = calculateCompletionPercent(milestonesForCalc)
  const cashflowBalance = totalClientPaymentsReceived - totalExpenses
  
  return {
    totalExpenses,
    totalClientPaymentsReceived,
    totalClientPaymentsPending,
    totalVendorPaymentsDue,
    additionalWorksApproved,
    totalContractValue,
    completionPercent,
    expectedProfitPercent: Number(project.expected_margin_percent),
    cashflowBalance
  }
}
