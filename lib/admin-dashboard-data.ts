import {
  calculateCompletionPercent,
  calculateForecastMarginPercent,
  calculateForecastProfit,
  calculatePlannedCompletionCost,
  calculateProjectedCompletionCost,
  calculateRealizedProfit,
  calculateTotalContractValue,
  type MilestoneData,
} from "@/lib/financial-calculations"
import { getProjectPmLabel } from "@/lib/staff-labels"
import type { Profile, ProjectStatus } from "@/lib/types/database"

export interface AdminProjectSummary {
  id: string
  name: string
  status: ProjectStatus
  contract_value: number
  total_expenses: number
  total_received: number
  pending_receivables: number
  pending_payables: number
  cashflow_warnings: number
  progress: number
  realized_profit: number
  forecast_profit: number
  forecast_margin_percent: number
  expected_profit: number
  pm_label: string
  expected_margin_percent: number
  has_stage_loss: boolean
}

function projectHasStageLoss(
  projectId: string,
  milestones: MilestoneRow[],
): boolean {
  return milestones.some((row) => {
    if (row.project_id !== projectId) return false
    const actual = Number(row.actual_expenses)
    const target = Number(row.target_budget)
    return actual > 0 && actual > target
  })
}

export interface AdminCompanyMetrics {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  onHoldProjects: number
  totalContractValue: number
  totalReceivables: number
  totalPayables: number
  currentCashflow: number
  expectedProfit: number
  realizedProfit: number
  forecastProfit: number
  forecastMarginPercent: number
  overbudgetProjects: number
  cashflowWarnings: number
  totalPMs: number
  totalEngineers: number
  weightedMarginPercent: number
}

export interface AdminDashboardData {
  projects: AdminProjectSummary[]
  company: AdminCompanyMetrics
  projectManagers: Pick<Profile, "id" | "email" | "full_name" | "role">[]
  siteEngineers: Pick<Profile, "id" | "email" | "full_name" | "role">[]
}

type ProjectRow = {
  id: string
  name: string
  status: ProjectStatus
  contract_value: number
  expected_margin_percent: number
  pm?: { full_name: string | null; email: string } | null
}

type MilestoneRow = {
  project_id: string
  name: string
  expected_cost_percent: number
  actual_completion_percent: number
  target_budget: number
  actual_expenses: number
  status: "pending" | "in-progress" | "completed"
}

type AmountRow = { project_id: string; amount: number }
type ClientPaymentRow = { project_id: string; amount: number; status: string }
type VendorPaymentRow = {
  project_id: string
  pending_amount: number
  status: string
}

function sumByProjectId(rows: AmountRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.project_id, (totals.get(row.project_id) ?? 0) + Number(row.amount))
  }
  return totals
}

function sumPayablesByProjectId(rows: VendorPaymentRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(
      row.project_id,
      (totals.get(row.project_id) ?? 0) + Number(row.pending_amount),
    )
  }
  return totals
}

function countOverdueByProjectId(rows: VendorPaymentRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    if (row.status !== "overdue") continue
    totals.set(row.project_id, (totals.get(row.project_id) ?? 0) + 1)
  }
  return totals
}

function groupMilestonesByProject(rows: MilestoneRow[]): Map<string, MilestoneData[]> {
  const grouped = new Map<string, MilestoneData[]>()
  for (const row of rows) {
    const milestones = grouped.get(row.project_id) ?? []
    milestones.push({
      name: row.name,
      expectedCostPercent: Number(row.expected_cost_percent),
      actualCompletionPercent: row.actual_completion_percent,
      targetBudget: Number(row.target_budget),
      actualExpenses: Number(row.actual_expenses),
      status: row.status,
    })
    grouped.set(row.project_id, milestones)
  }
  return grouped
}

export function buildAdminDashboardData(input: {
  projects: ProjectRow[]
  milestones: MilestoneRow[]
  expenses: AmountRow[]
  clientPayments: ClientPaymentRow[]
  additionalWorks: AmountRow[]
  vendorPayments: VendorPaymentRow[]
  staffProfiles: Pick<Profile, "id" | "email" | "full_name" | "role">[]
}): AdminDashboardData {
  const expenseTotals = sumByProjectId(input.expenses)
  const receivedTotals = sumByProjectId(
    input.clientPayments.filter((payment) => payment.status === "received")
  )
  const receivableTotals = sumByProjectId(
    input.clientPayments.filter(
      (payment) => payment.status === "pending" || payment.status === "overdue"
    )
  )
  const additionalWorkTotals = sumByProjectId(input.additionalWorks)
  const payableTotals = sumPayablesByProjectId(input.vendorPayments)
  const overdueTotals = countOverdueByProjectId(input.vendorPayments)
  const milestonesByProject = groupMilestonesByProject(input.milestones)

  const projects: AdminProjectSummary[] = input.projects.map((project) => {
    const additionalWorksApproved = additionalWorkTotals.get(project.id) ?? 0
    const totalContractValue = calculateTotalContractValue(
      Number(project.contract_value),
      additionalWorksApproved
    )
    const totalExpenses = expenseTotals.get(project.id) ?? 0
    const totalReceived = receivedTotals.get(project.id) ?? 0
    const milestones = milestonesByProject.get(project.id) ?? []
    const progress = calculateCompletionPercent(milestones)
    const marginPercent = Number(project.expected_margin_percent)
    const expectedProfit = totalContractValue * (marginPercent / 100)
    const plannedCompletionCost = calculatePlannedCompletionCost(
      totalContractValue,
      expectedProfit,
    )
    const projectedCompletionCost = calculateProjectedCompletionCost(
      totalExpenses,
      progress,
      plannedCompletionCost,
    )
    const realizedProfit = calculateRealizedProfit(totalReceived, totalExpenses)
    const forecastProfit = calculateForecastProfit(
      totalContractValue,
      projectedCompletionCost,
    )
    const forecastMarginPercent = calculateForecastMarginPercent(
      forecastProfit,
      totalContractValue,
    )

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      contract_value: totalContractValue,
      total_expenses: totalExpenses,
      total_received: totalReceived,
      pending_receivables: receivableTotals.get(project.id) ?? 0,
      pending_payables: payableTotals.get(project.id) ?? 0,
      cashflow_warnings: overdueTotals.get(project.id) ?? 0,
      progress,
      realized_profit: realizedProfit,
      forecast_profit: forecastProfit,
      forecast_margin_percent: forecastMarginPercent,
      expected_profit: expectedProfit,
      pm_label: getProjectPmLabel(project),
      expected_margin_percent: marginPercent,
      has_stage_loss: projectHasStageLoss(project.id, input.milestones),
    }
  })

  const projectManagers = input.staffProfiles.filter((profile) => profile.role === "pm")
  const siteEngineers = input.staffProfiles.filter((profile) => profile.role === "engineer")

  const company = aggregateAdminCompanyMetrics(projects, {
    totalPMs: projectManagers.length,
    totalEngineers: siteEngineers.length,
    cashflowWarnings: input.vendorPayments.filter(
      (payment) => payment.status === "overdue",
    ).length,
  })

  return {
    projects,
    company,
    projectManagers,
    siteEngineers,
  }
}

export function aggregateAdminCompanyMetrics(
  projects: AdminProjectSummary[],
  staff: { totalPMs: number; totalEngineers: number; cashflowWarnings?: number },
): AdminCompanyMetrics {
  const totalContractValue = projects.reduce((sum, project) => sum + project.contract_value, 0)
  const totalExpenses = projects.reduce((sum, project) => sum + project.total_expenses, 0)
  const receivedPayments = projects.reduce((sum, project) => sum + project.total_received, 0)
  const realizedProfit = projects.reduce((sum, project) => sum + project.realized_profit, 0)
  const forecastProfit = projects.reduce((sum, project) => sum + project.forecast_profit, 0)
  const expectedProfit = projects.reduce((sum, project) => sum + project.expected_profit, 0)
  const forecastMarginPercent = calculateForecastMarginPercent(forecastProfit, totalContractValue)
  const totalReceivables = projects.reduce(
    (sum, project) => sum + project.pending_receivables,
    0,
  )
  const totalPayables = projects.reduce((sum, project) => sum + project.pending_payables, 0)
  const weightedMarginPercent =
    totalContractValue > 0 ? Math.round((expectedProfit / totalContractValue) * 100) : 0

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "active").length,
    completedProjects: projects.filter((project) => project.status === "completed").length,
    onHoldProjects: projects.filter((project) => project.status === "on-hold").length,
    totalContractValue,
    totalReceivables,
    totalPayables,
    currentCashflow: receivedPayments - totalExpenses,
    expectedProfit,
    realizedProfit,
    forecastProfit,
    forecastMarginPercent,
    overbudgetProjects: projects.filter((project) => project.forecast_profit < 0).length,
    cashflowWarnings:
      staff.cashflowWarnings ??
      projects.reduce((sum, project) => sum + project.cashflow_warnings, 0),
    totalPMs: staff.totalPMs,
    totalEngineers: staff.totalEngineers,
    weightedMarginPercent,
  }
}
