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
import { shouldUseLiveFinancials } from "@/lib/projects/lifecycle"
import { CONSTRUCTION_PREVIEW_MILESTONES } from "@/lib/projects/construction-preview"

async function fetchFromApi<T>(path: string): Promise<T> {
  const startedAt = Date.now()
  let res: Response
  try {
    res = await fetch(path, {
      credentials: "include",
      signal: AbortSignal.timeout(20_000),
    })
  } catch (error) {
    const name =
      error instanceof DOMException || error instanceof Error ? error.name : ""
    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b15f8a'},body:JSON.stringify({sessionId:'b15f8a',runId:'post-fix',hypothesisId:'C',location:'lib/hooks/use-project-data.ts:fetchFromApi',message:'projects api fetch threw',data:{path,name,ms:Date.now()-startedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (name === "TimeoutError" || name === "AbortError") {
      throw new Error("This is taking too long. Refresh and try again.")
    }
    throw error
  }
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const message =
      typeof json.error === "string"
        ? json.error
        : `Request failed (${res.status})`
    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b15f8a'},body:JSON.stringify({sessionId:'b15f8a',runId:'post-fix',hypothesisId:'C',location:'lib/hooks/use-project-data.ts:fetchFromApi',message:'projects api not ok',data:{path,status:res.status,message,ms:Date.now()-startedAt},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    throw new Error(message)
  }

  // #region agent log
  fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b15f8a'},body:JSON.stringify({sessionId:'b15f8a',runId:'post-fix',hypothesisId:'C',location:'lib/hooks/use-project-data.ts:fetchFromApi',message:'projects api ok',data:{path,status:res.status,ms:Date.now()-startedAt,rows:Array.isArray(json.data)?json.data.length:json.data==null?0:1},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return json.data as T
}

async function fetchProjects(includeArchived = false, summaryOnly = false) {
  const params = new URLSearchParams()
  if (includeArchived) params.set("includeArchived", "true")
  if (summaryOnly) params.set("summary", "true")
  const query = params.toString() ? `?${params.toString()}` : ""
  const data = await fetchFromApi<ProjectWithDetails[] | null>(`/api/projects${query}`)
  return Array.isArray(data) ? data : []
}

async function fetchProject(projectId: string) {
  return fetchFromApi<ProjectWithDetails>(`/api/projects/${projectId}`)
}

async function fetchDefaultProject() {
  return fetchFromApi<ProjectWithDetails | null>("/api/projects/default").then((data) => {
    if (!data) {
      throw new Error(NO_ASSIGNED_PROJECT_MESSAGE)
    }
    return data
  })
}

async function fetchLabourTypes() {
  return fetchFromApi<LabourType[]>("/api/labour-types")
}

const swrDefaults = {
  revalidateOnFocus: false,
  dedupingInterval: 30_000,
  errorRetryCount: 0,
  shouldRetryOnError: false,
}

// Hook: Get all projects (includeArchived for Projects list page only)
export function useProjects(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false
  const swrKey = includeArchived ? "projects-all-summary" : "projects-summary"
  const { data, error, isLoading, mutate } = useSWR(
    swrKey,
    () => fetchProjects(includeArchived, true),
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
      cashflowBalance: 0,
      isPreviewMode: false,
    }
  }

  const liveFinancials = shouldUseLiveFinancials(project)

  if (!liveFinancials) {
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
      expectedProfitPercent: Number(project.expected_margin_percent),
      cashflowBalance: 0,
      isPreviewMode: true,
    }
  }
  
  const expenses = project.expenses ?? []
  const clientPayments = project.client_payments ?? []
  const vendorPayments = project.vendor_payments ?? []
  const milestonesList = project.milestones ?? []

  const totalExpenses = expenses
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount), 0)
  
  const totalClientPaymentsReceived = clientPayments
    .filter(p => p.status === 'received')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  
  const totalClientPaymentsPending = clientPayments
    .filter(p => p.status === 'pending' || p.status === 'overdue')
    .reduce((sum, p) => sum + Number(p.amount), 0)
  
  const totalVendorPaymentsDue = vendorPayments
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
  
  const milestonesForCalc: MilestoneData[] = milestonesList.map(ms => ({
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
    cashflowBalance,
    isPreviewMode: false,
  }
}

/** Milestones for customer display when construction is not yet active. */
export function useCustomerMilestones(project: ProjectWithDetails | null) {
  if (!project) return []
  if (shouldUseLiveFinancials(project)) {
    return project.milestones.map((ms) => ({
      name: ms.name,
      status: ms.status,
    }))
  }
  return CONSTRUCTION_PREVIEW_MILESTONES
}
