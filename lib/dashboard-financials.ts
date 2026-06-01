import {
  calculateBudgetUsagePercent,
  calculateCurrentCashflow,
  calculateExpectedProfit,
  calculateRemainingBudget,
  calculateStageBudget,
  calculateTotalContractValue,
  type MilestoneData,
} from "@/lib/financial-calculations"

export type ProjectHealthStatus =
  | "on_track"
  | "cash_risk"
  | "collection_risk"
  | "stage_loss"
  | "over_budget"

export function sumCompletedStageProfitLoss(milestones: MilestoneData[]): number {
  return milestones
    .filter(
      (ms) =>
        ms.status === "completed" ||
        ms.actualCompletionPercent === 100,
    )
    .reduce((sum, ms) => sum + (ms.targetBudget - ms.actualExpenses), 0)
}

export function hasCompletedStageLoss(milestones: MilestoneData[]): boolean {
  return milestones.some((ms) => {
    const completed =
      ms.status === "completed" || ms.actualCompletionPercent === 100
    return completed && ms.actualExpenses > ms.targetBudget
  })
}

export function percentOfContract(value: number, contractValue: number): number {
  if (contractValue <= 0) return 0
  return Math.round((value / contractValue) * 1000) / 10
}

export function deriveProjectHealth(input: {
  totalContractValue: number
  totalReceived: number
  totalExpenses: number
  remainingStageBudget: number
  milestones: MilestoneData[]
}): ProjectHealthStatus {
  const cashBalance = calculateCurrentCashflow(input.totalReceived, input.totalExpenses)
  const receivedPercent = percentOfContract(
    input.totalReceived,
    input.totalContractValue,
  )

  if (input.remainingStageBudget < 0) return "over_budget"
  if (cashBalance < 0) return "cash_risk"
  if (hasCompletedStageLoss(input.milestones)) return "stage_loss"
  if (
    receivedPercent > 0 &&
    receivedPercent < 85 &&
    input.totalExpenses > input.totalReceived * 0.85
  ) {
    return "collection_risk"
  }
  return "on_track"
}

export const PROJECT_HEALTH_LABELS: Record<ProjectHealthStatus, string> = {
  on_track: "On track",
  cash_risk: "Cash risk",
  collection_risk: "Collection gap",
  stage_loss: "Stage loss",
  over_budget: "Over budget",
}

export function summarizeProjectFinancialLayers(input: {
  contractValue: number
  additionalWorksApproved: number
  expectedMarginPercent: number
  totalExpenses: number
  totalReceived: number
  milestones: MilestoneData[]
}) {
  const totalContractValue = calculateTotalContractValue(
    input.contractValue,
    input.additionalWorksApproved,
  )
  const plannedProfit = calculateExpectedProfit(
    totalContractValue,
    input.expectedMarginPercent,
  )
  const totalStageBudget = calculateStageBudget(totalContractValue, plannedProfit)
  const remainingStageBudget = calculateRemainingBudget(
    totalStageBudget,
    input.totalExpenses,
  )
  const cashBalance = calculateCurrentCashflow(
    input.totalReceived,
    input.totalExpenses,
  )
  const balanceToCollect = totalContractValue - input.totalReceived
  const receivedPercent = percentOfContract(input.totalReceived, totalContractValue)
  const budgetUsagePercent = calculateBudgetUsagePercent(
    input.totalExpenses,
    totalStageBudget,
  )
  const completedStageProfitLoss = sumCompletedStageProfitLoss(input.milestones)
  const health = deriveProjectHealth({
    totalContractValue,
    totalReceived: input.totalReceived,
    totalExpenses: input.totalExpenses,
    remainingStageBudget,
    milestones: input.milestones,
  })

  return {
    totalContractValue,
    plannedProfit,
    totalStageBudget,
    remainingStageBudget,
    cashBalance,
    balanceToCollect,
    receivedPercent,
    budgetUsagePercent,
    completedStageProfitLoss,
    health,
  }
}
