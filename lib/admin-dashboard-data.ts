import {
  calculateCompletionPercent,
  calculateProjectedProfit,
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
  progress: number
  profit_loss: number
  pm_label: string
  expected_margin_percent: number
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
  projectedProfit: number
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
type VendorPaymentRow = { pending_amount: number; status: string }

function sumByProjectId(rows: AmountRow[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    totals.set(row.project_id, (totals.get(row.project_id) ?? 0) + Number(row.amount))
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
    const profitLoss = calculateProjectedProfit(totalContractValue, totalExpenses)

    return {
      id: project.id,
      name: project.name,
      status: project.status,
      contract_value: totalContractValue,
      total_expenses: totalExpenses,
      total_received: totalReceived,
      progress,
      profit_loss: profitLoss,
      pm_label: getProjectPmLabel(project),
      expected_margin_percent: Number(project.expected_margin_percent),
    }
  })

  const projectManagers = input.staffProfiles.filter((profile) => profile.role === "pm")
  const siteEngineers = input.staffProfiles.filter((profile) => profile.role === "engineer")

  const totalContractValue = projects.reduce((sum, project) => sum + project.contract_value, 0)
  const totalExpenses = projects.reduce((sum, project) => sum + project.total_expenses, 0)
  const receivedPayments = projects.reduce((sum, project) => sum + project.total_received, 0)
  const projectedProfit = projects.reduce((sum, project) => sum + project.profit_loss, 0)
  const expectedProfit = projects.reduce(
    (sum, project) =>
      sum + project.contract_value * (project.expected_margin_percent / 100),
    0
  )
  const totalReceivables = Array.from(receivableTotals.values()).reduce(
    (sum, amount) => sum + amount,
    0
  )
  const totalPayables = input.vendorPayments.reduce(
    (sum, payment) => sum + Number(payment.pending_amount),
    0
  )
  const cashflowWarnings = input.vendorPayments.filter(
    (payment) => payment.status === "overdue"
  ).length
  const weightedMarginPercent =
    totalContractValue > 0 ? Math.round((expectedProfit / totalContractValue) * 100) : 0

  const company: AdminCompanyMetrics = {
    totalProjects: projects.length,
    activeProjects: projects.filter((project) => project.status === "active").length,
    completedProjects: projects.filter((project) => project.status === "completed").length,
    onHoldProjects: projects.filter((project) => project.status === "on-hold").length,
    totalContractValue,
    totalReceivables,
    totalPayables,
    currentCashflow: receivedPayments - totalExpenses,
    expectedProfit,
    projectedProfit,
    overbudgetProjects: projects.filter((project) => project.profit_loss < 0).length,
    cashflowWarnings,
    totalPMs: projectManagers.length,
    totalEngineers: siteEngineers.length,
    weightedMarginPercent,
  }

  return {
    projects,
    company,
    projectManagers,
    siteEngineers,
  }
}
