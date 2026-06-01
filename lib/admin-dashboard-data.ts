import {
  calculateCompletionPercent,
  calculateExpectedProfit,
  calculateForecastMarginPercent,
  calculateForecastProfit,
  calculatePlannedCompletionCost,
  calculateProjectedCompletionCost,
  calculateRealizedProfit,
  calculateRemainingBudget,
  calculateStageBudget,
  calculateTotalContractValue,
  type MilestoneData,
} from "@/lib/financial-calculations"
import {
  deriveProjectHealth,
  hasCompletedStageLoss,
  percentOfContract,
  sumCompletedStageProfitLoss,
  type ProjectHealthStatus,
} from "@/lib/dashboard-financials"
import {
  buildPortfolioSpentTimelineLines,
  buildSpentTimelineLines,
  deriveProjectTimeline,
  type ProjectTimelineContext,
} from "@/lib/project-timeline"
import { getProjectPmLabel } from "@/lib/staff-labels"
import { deriveProjectIdleStatus, type ProjectIdleStatus } from "@/lib/project-idle"
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
  /** Reserved margin at plan — not cash profit */
  planned_profit: number
  total_stage_budget: number
  remaining_stage_budget: number
  cash_balance: number
  balance_to_collect: number
  received_percent: number
  budget_usage_percent: number
  completed_stage_profit_loss: number
  health: ProjectHealthStatus
  pm_label: string
  expected_margin_percent: number
  has_stage_loss: boolean
  spent_timeline_lines: string[]
  idle: ProjectIdleStatus
  /** Legacy — kept for internal aggregates; not shown as primary KPI */
  realized_profit: number
  forecast_profit: number
  forecast_margin_percent: number
}

export interface AdminCompanyMetrics {
  totalProjects: number
  activeProjects: number
  completedProjects: number
  onHoldProjects: number
  totalContractValue: number
  totalPlannedProfit: number
  totalReceivables: number
  totalPayables: number
  portfolioCashBalance: number
  totalReceived: number
  totalSpent: number
  portfolioReceivedPercent: number
  totalBalanceToCollect: number
  totalCompletedStageProfitLoss: number
  overbudgetProjects: number
  cashRiskProjects: number
  stageLossProjects: number
  collectionRiskProjects: number
  cashflowWarnings: number
  totalPMs: number
  totalEngineers: number
  weightedMarginPercent: number
  portfolioSpentTimelineLines: string[]
  /** Legacy */
  currentCashflow: number
  expectedProfit: number
  realizedProfit: number
  forecastProfit: number
  forecastMarginPercent: number
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
  start_date?: string | null
  expected_completion_date?: string | null
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

type ExpenseRow = {
  project_id: string
  amount: number
  expense_date: string
  status?: string
}
type ManpowerWeekRow = { project_id: string; start_date: string }
type AmountRow = { project_id: string; amount: number }
type ClientPaymentRow = {
  project_id: string
  amount: number
  status: string
  received_date?: string | null
}
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

function groupStringsByProject(
  rows: { project_id: string; value: string }[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const list = grouped.get(row.project_id) ?? []
    list.push(row.value)
    grouped.set(row.project_id, list)
  }
  return grouped
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
  expenses: ExpenseRow[]
  allExpenseDates: ExpenseRow[]
  manpowerWeeks: ManpowerWeekRow[]
  clientPayments: ClientPaymentRow[]
  additionalWorks: AmountRow[]
  vendorPayments: VendorPaymentRow[]
  staffProfiles: Pick<Profile, "id" | "email" | "full_name" | "role">[]
}): AdminDashboardData {
  const approvedExpenses = input.expenses.filter(
    (row) => !row.status || row.status === "approved",
  )
  const expenseTotals = sumByProjectId(approvedExpenses)
  const receivedTotals = sumByProjectId(
    input.clientPayments.filter((payment) => payment.status === "received"),
  )
  const receivableTotals = sumByProjectId(
    input.clientPayments.filter(
      (payment) => payment.status === "pending" || payment.status === "overdue",
    ),
  )
  const additionalWorkTotals = sumByProjectId(input.additionalWorks)
  const payableTotals = sumPayablesByProjectId(input.vendorPayments)
  const overdueTotals = countOverdueByProjectId(input.vendorPayments)
  const milestonesByProject = groupMilestonesByProject(input.milestones)
  const expenseDatesByProject = groupStringsByProject(
    approvedExpenses.map((row) => ({
      project_id: row.project_id,
      value: row.expense_date,
    })),
  )
  const allExpenseDatesByProject = groupStringsByProject(
    input.allExpenseDates.map((row) => ({
      project_id: row.project_id,
      value: row.expense_date,
    })),
  )
  const manpowerStartsByProject = groupStringsByProject(
    input.manpowerWeeks.map((row) => ({
      project_id: row.project_id,
      value: row.start_date,
    })),
  )
  const paymentDatesByProject = groupStringsByProject(
    input.clientPayments
      .filter((row) => row.status === "received" && row.received_date)
      .map((row) => ({
        project_id: row.project_id,
        value: row.received_date as string,
      })),
  )

  const projectTimelines: ProjectTimelineContext[] = []

  const projects: AdminProjectSummary[] = input.projects.map((project) => {
    const additionalWorksApproved = additionalWorkTotals.get(project.id) ?? 0
    const totalContractValue = calculateTotalContractValue(
      Number(project.contract_value),
      additionalWorksApproved,
    )
    const totalExpenses = expenseTotals.get(project.id) ?? 0
    const totalReceived = receivedTotals.get(project.id) ?? 0
    const milestones = milestonesByProject.get(project.id) ?? []
    const progress = calculateCompletionPercent(milestones)
    const marginPercent = Number(project.expected_margin_percent)
    const plannedProfit = calculateExpectedProfit(
      totalContractValue,
      marginPercent,
    )
    const totalStageBudget = calculateStageBudget(totalContractValue, plannedProfit)
    const remainingStageBudget = calculateRemainingBudget(totalStageBudget, totalExpenses)
    const cashBalance = totalReceived - totalExpenses
    const balanceToCollect = totalContractValue - totalReceived
    const receivedPercent = percentOfContract(totalReceived, totalContractValue)
    const budgetUsagePercent =
      totalStageBudget > 0
        ? Math.round((totalExpenses / totalStageBudget) * 1000) / 10
        : 0
    const completedStageProfitLoss = sumCompletedStageProfitLoss(milestones)
    const health = deriveProjectHealth({
      totalContractValue,
      totalReceived,
      totalExpenses,
      remainingStageBudget,
      milestones,
    })

    const plannedCompletionCost = calculatePlannedCompletionCost(
      totalContractValue,
      plannedProfit,
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

    const timeline = deriveProjectTimeline({
      startDate: project.start_date,
      expectedCompletionDate: project.expected_completion_date,
      expenseDates: expenseDatesByProject.get(project.id) ?? [],
      paymentReceivedDates: paymentDatesByProject.get(project.id) ?? [],
    })
    projectTimelines.push(timeline)
    const spent_timeline_lines = buildSpentTimelineLines(timeline)

    const idle = deriveProjectIdleStatus({
      startDate: project.start_date,
      status: project.status,
      expenses: (allExpenseDatesByProject.get(project.id) ?? []).map(
        (expense_date) => ({ expense_date }),
      ),
      manpowerWeekStarts: manpowerStartsByProject.get(project.id) ?? [],
    })

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
      planned_profit: plannedProfit,
      total_stage_budget: totalStageBudget,
      remaining_stage_budget: remainingStageBudget,
      cash_balance: cashBalance,
      balance_to_collect: balanceToCollect,
      received_percent: receivedPercent,
      budget_usage_percent: budgetUsagePercent,
      completed_stage_profit_loss: completedStageProfitLoss,
      health,
      pm_label: getProjectPmLabel(project),
      expected_margin_percent: marginPercent,
      has_stage_loss: hasCompletedStageLoss(milestones),
      spent_timeline_lines,
      idle,
      realized_profit: realizedProfit,
      forecast_profit: forecastProfit,
      forecast_margin_percent: forecastMarginPercent,
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
    projectTimelines,
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
  staff: {
    totalPMs: number
    totalEngineers: number
    cashflowWarnings?: number
    projectTimelines?: ProjectTimelineContext[]
  },
): AdminCompanyMetrics {
  const totalContractValue = projects.reduce((sum, project) => sum + project.contract_value, 0)
  const totalSpent = projects.reduce((sum, project) => sum + project.total_expenses, 0)
  const totalReceived = projects.reduce((sum, project) => sum + project.total_received, 0)
  const portfolioCashBalance = totalReceived - totalSpent
  const totalPlannedProfit = projects.reduce((sum, project) => sum + project.planned_profit, 0)
  const totalBalanceToCollect = projects.reduce(
    (sum, project) => sum + project.balance_to_collect,
    0,
  )
  const totalCompletedStageProfitLoss = projects.reduce(
    (sum, project) => sum + project.completed_stage_profit_loss,
    0,
  )
  const realizedProfit = projects.reduce((sum, project) => sum + project.realized_profit, 0)
  const forecastProfit = projects.reduce((sum, project) => sum + project.forecast_profit, 0)
  const forecastMarginPercent = calculateForecastMarginPercent(forecastProfit, totalContractValue)
  const totalReceivables = projects.reduce(
    (sum, project) => sum + project.pending_receivables,
    0,
  )
  const totalPayables = projects.reduce((sum, project) => sum + project.pending_payables, 0)
  const weightedMarginPercent =
    totalContractValue > 0 ? Math.round((totalPlannedProfit / totalContractValue) * 100) : 0
  const portfolioReceivedPercent = percentOfContract(totalReceived, totalContractValue)
  const portfolioSpentTimelineLines = buildPortfolioSpentTimelineLines({
    projectTimelines: staff.projectTimelines ?? [],
  })

  return {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "active").length,
    completedProjects: projects.filter((project) => project.status === "completed").length,
    onHoldProjects: projects.filter((project) => project.status === "on-hold").length,
    totalContractValue,
    totalPlannedProfit,
    totalReceivables,
    totalPayables,
    portfolioCashBalance,
    totalReceived,
    totalSpent,
    portfolioReceivedPercent,
    totalBalanceToCollect,
    totalCompletedStageProfitLoss,
    overbudgetProjects: projects.filter((project) => project.remaining_stage_budget < 0).length,
    cashRiskProjects: projects.filter((project) => project.health === "cash_risk").length,
    stageLossProjects: projects.filter((project) => project.health === "stage_loss").length,
    collectionRiskProjects: projects.filter(
      (project) => project.health === "collection_risk",
    ).length,
    cashflowWarnings:
      staff.cashflowWarnings ??
      projects.reduce((sum, project) => sum + project.cashflow_warnings, 0),
    totalPMs: staff.totalPMs,
    totalEngineers: staff.totalEngineers,
    weightedMarginPercent,
    portfolioSpentTimelineLines,
    currentCashflow: portfolioCashBalance,
    expectedProfit: totalPlannedProfit,
    realizedProfit,
    forecastProfit,
    forecastMarginPercent,
  }
}
