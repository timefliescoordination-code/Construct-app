"use client"

import useSWR from "swr"
import type { 
  Milestone, 
  Expense, 
  ClientPayment, 
  AdditionalWork, 
  ProjectWithDetails,
  LabourType,
} from "@/lib/types/database"
import {
  calculateTotalContractValue,
  calculateCompletionPercent,
  calculateProjectedProfit,
  getApprovedAdditionalWorksTotal,
  summarizeProjectFinancials,
  type MilestoneData
} from "@/lib/financial-calculations"
import { enrichProjectWithMilestoneMetrics } from "@/lib/project-tab-hydration"
import { getProjectPmLabel, getProjectEngineersLabel } from "@/lib/staff-labels"
import { projectIdleFromProject } from "@/lib/project-idle"
import { NO_ASSIGNED_PROJECT_MESSAGE } from "@/lib/project-access"

async function fetchFromApi<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message =
      typeof json.error === "string"
        ? json.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }

  return json.data as T
}

async function fetchProjects(includeArchived = false) {
  const query = includeArchived ? "?includeArchived=true" : ""
  return fetchFromApi<ProjectWithDetails[]>(`/api/projects${query}`)
}

async function fetchProject(projectId: string) {
  return fetchFromApi<ProjectWithDetails>(`/api/projects/${projectId}`)
}

async function fetchDefaultProject() {
  const res = await fetch("/api/projects/default", { credentials: "include" })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message =
      typeof json.error === "string"
        ? json.error
        : `Request failed (${res.status})`
    throw new Error(message)
  }

  if (json.error && typeof json.error === "string") {
    throw new Error(json.error)
  }

  const data = json.data as ProjectWithDetails | null
  if (!data) {
    throw new Error(NO_ASSIGNED_PROJECT_MESSAGE)
  }
  return data
}

async function fetchLabourTypes() {
  return fetchFromApi<LabourType[]>("/api/labour-types")
}

const swrDefaults = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
}

// Hook: Get all projects (includeArchived for Projects list page only)
export function useProjects(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false
  const swrKey = includeArchived ? 'projects-all' : 'projects'
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchProjects(includeArchived),
    swrDefaults,
  )
  
  const projectSummaries = (data || []).map(project => {
    const totalExpenses = project.expenses
      ?.filter((e: Expense) => e.status === 'approved')
      .reduce((sum: number, e: Expense) => sum + Number(e.amount), 0) || 0
    
    const totalReceived = project.client_payments
      ?.filter((p: ClientPayment) => p.status === 'received')
      .reduce((sum: number, p: ClientPayment) => sum + Number(p.amount), 0) || 0
    
    const additionalWorksApproved = getApprovedAdditionalWorksTotal(
      project.additional_works,
      project.additional_works_value,
    )
    
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
    
    const idle = projectIdleFromProject({
      start_date: project.start_date,
      status: project.status,
      expenses: (project.expenses ?? []).map((e: Expense) => ({
        expense_date: e.expense_date,
      })),
    })

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
      idle,
    }
  })
  
  return {
    projects: projectSummaries,
    isLoading,
    error,
    mutate
  }
}

/** Full project rows (expenses, milestones, etc.) for dashboards that need detail per site. */
export function useProjectDetailsList(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false
  const swrKey = includeArchived ? 'project-details-all' : 'project-details'

  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchProjects(includeArchived),
    swrDefaults,
  )

  return {
    projects: (data ?? []).map((project) => enrichProjectWithMilestoneMetrics(project)),
    isLoading,
    error,
    mutate,
  }
}

// Hook: Get single project with all details
export function useProject(projectId: string | null) {
  const { data, error, isLoading, mutate } = useSWR(
    projectId ? `project-${projectId}` : null,
    () => projectId ? fetchProject(projectId) : null,
    swrDefaults,
  )
  
  return {
    project: data ? enrichProjectWithMilestoneMetrics(data) : null,
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
  
  return {
    project: data ? enrichProjectWithMilestoneMetrics(data) : null,
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
      stageBudget: 0,
      remainingStageBudget: 0,
      stageBudgetUsagePercent: 0,
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
  
  const additionalWorksApproved = getApprovedAdditionalWorksTotal(
    project.additional_works,
    project.additional_works_value,
  )
  
  const totalContractValue = calculateTotalContractValue(
    Number(project.contract_value), 
    additionalWorksApproved
  )

  const finances = summarizeProjectFinancials({
    contractValue: Number(project.contract_value),
    additionalWorksApproved,
    expectedMarginPercent: Number(project.expected_margin_percent),
    totalExpenses,
  })
  
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
    stageBudget: finances.stageBudget,
    remainingStageBudget: finances.remainingStageBudget,
    stageBudgetUsagePercent: finances.stageBudgetUsagePercent,
    completionPercent,
    expectedProfitPercent: Number(project.expected_margin_percent),
    cashflowBalance
  }
}
