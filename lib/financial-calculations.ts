/**
 * Centralized Financial Calculations Module
 * 
 * Single source of truth for all financial computations across the VRA HOMES app.
 * All dashboards (Admin, PM, Engineer, Customer) must use these calculations.
 * No GST/tax calculations - all values are direct amounts.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface ProjectFinancialData {
  contractValue: number
  additionalWorks: number
  expectedMarginPercent: number
  totalExpenses: number
  totalClientPaymentsReceived: number
  totalClientPaymentsPending: number
  totalVendorPaymentsDue: number
  totalVendorPaymentsPaid: number
  milestones?: MilestoneData[]
}

export interface MilestoneData {
  name: string
  expectedCostPercent: number
  actualCompletionPercent: number
  targetBudget: number
  actualExpenses: number
  status: "pending" | "in-progress" | "completed"
}

export interface CalculatedProjectMetrics {
  // Contract values
  originalContractValue: number
  additionalWorksApproved: number
  totalContractValue: number
  
  // Profit calculations
  expectedMarginPercent: number
  expectedProfitAmount: number
  stageBudget: number
  
  // Expense tracking
  totalExpenses: number
  remainingBudget: number
  budgetUsagePercent: number
  
  // Client payments
  totalClientPaymentsReceived: number
  totalClientPaymentsPending: number
  
  // Vendor payments
  totalVendorPaymentsDue: number
  totalVendorPaymentsPaid: number
  
  // Cashflow
  currentCashflow: number
  cashflowStatus: "positive" | "warning" | "negative"
  
  // Live profit (based on actual expenses)
  currentProfit: number
  projectedProfit: number
  
  // Completion
  completionPercent: number
  
  // Health indicators
  isOverBudget: boolean
  hasCashflowRisk: boolean
}

export interface CompletedStageAnalysis {
  stages: Array<{
    name: string
    targetBudget: number
    actualExpenses: number
    profit: number
  }>
  totalTargetBudget: number
  totalActualExpenses: number
  totalProfit: number
}

// =============================================================================
// CORE CALCULATIONS
// =============================================================================

/**
 * Calculate total contract value (original + additional works)
 * No tax calculations - direct sum
 */
export function calculateTotalContractValue(
  contractValue: number,
  additionalWorks: number
): number {
  return contractValue + additionalWorks
}

/**
 * Calculate expected profit amount based on margin percentage
 */
export function calculateExpectedProfit(
  totalContractValue: number,
  marginPercent: number
): number {
  return totalContractValue * (marginPercent / 100)
}

/**
 * Calculate stage budget (what's available for actual construction expenses)
 * Stage Budget = Total Contract Value - Expected Profit
 */
export function calculateStageBudget(
  totalContractValue: number,
  expectedProfit: number
): number {
  return totalContractValue - expectedProfit
}

/**
 * Calculate remaining budget
 */
export function calculateRemainingBudget(
  totalContractValue: number,
  totalExpenses: number
): number {
  return totalContractValue - totalExpenses
}

/**
 * Calculate budget usage percentage
 */
export function calculateBudgetUsagePercent(
  totalExpenses: number,
  totalContractValue: number
): number {
  if (totalContractValue <= 0) return 0
  return Math.round((totalExpenses / totalContractValue) * 100)
}

/**
 * Calculate current cashflow (received - spent)
 */
export function calculateCurrentCashflow(
  totalReceived: number,
  totalExpenses: number
): number {
  return totalReceived - totalExpenses
}

/**
 * Calculate current profit (what we've actually earned so far)
 */
export function calculateCurrentProfit(
  totalReceived: number,
  totalExpenses: number
): number {
  return totalReceived - totalExpenses
}

/**
 * Calculate projected profit (if expenses continue at current rate)
 */
export function calculateProjectedProfit(
  totalContractValue: number,
  totalExpenses: number
): number {
  return totalContractValue - totalExpenses
}

/**
 * Calculate completion percentage based on milestones
 */
export function calculateCompletionPercent(milestones: MilestoneData[]): number {
  if (!milestones || milestones.length === 0) return 0
  
  const totalWeight = milestones.reduce((sum, ms) => sum + ms.expectedCostPercent, 0)
  if (totalWeight === 0) return 0
  
  const completedWeight = milestones.reduce((sum, ms) => {
    return sum + (ms.expectedCostPercent * ms.actualCompletionPercent / 100)
  }, 0)
  
  return Math.round((completedWeight / totalWeight) * 100)
}

/**
 * Determine cashflow status
 */
export function determineCashflowStatus(
  cashflow: number,
  budgetUsagePercent: number,
  completionPercent: number
): "positive" | "warning" | "negative" {
  if (cashflow < 0) return "negative"
  if (budgetUsagePercent > completionPercent + 10) return "warning"
  return "positive"
}

/**
 * Check if project is over budget
 */
export function checkIsOverBudget(
  budgetUsagePercent: number,
  completionPercent: number,
  overbudgetStagesCount: number
): boolean {
  return budgetUsagePercent > completionPercent + 15 || overbudgetStagesCount > 0
}

/**
 * Check if project has cashflow risk
 */
export function checkHasCashflowRisk(
  cashflow: number,
  totalReceived: number,
  totalExpenses: number,
  hasOverdueClientPayments: boolean,
  hasOverdueVendorBills: boolean
): boolean {
  const hasNegativeCashflow = totalReceived < totalExpenses * 0.7
  return cashflow < 0 || hasNegativeCashflow || (hasOverdueClientPayments && hasOverdueVendorBills)
}

// =============================================================================
// COMPLETED STAGES ANALYSIS
// =============================================================================

/**
 * Analyze completed stages for profit/loss calculation
 */
export function analyzeCompletedStages(milestones: MilestoneData[]): CompletedStageAnalysis {
  const completedStages = milestones.filter(ms => ms.actualCompletionPercent === 100)
  
  const stages = completedStages.map(stage => ({
    name: stage.name,
    targetBudget: stage.targetBudget,
    actualExpenses: stage.actualExpenses,
    profit: stage.targetBudget - stage.actualExpenses
  }))
  
  const totalTargetBudget = stages.reduce((sum, s) => sum + s.targetBudget, 0)
  const totalActualExpenses = stages.reduce((sum, s) => sum + s.actualExpenses, 0)
  const totalProfit = totalTargetBudget - totalActualExpenses
  
  return {
    stages,
    totalTargetBudget,
    totalActualExpenses,
    totalProfit
  }
}

/**
 * Get overbudget stages
 */
export function getOverbudgetStages(milestones: MilestoneData[]): MilestoneData[] {
  return milestones.filter(ms => 
    ms.actualExpenses > ms.targetBudget && ms.actualCompletionPercent > 0
  )
}

// =============================================================================
// MAIN CALCULATION FUNCTION
// =============================================================================

/**
 * Calculate all project metrics from base data
 * This is the main function that should be used by all components
 */
export function calculateProjectMetrics(data: ProjectFinancialData): CalculatedProjectMetrics {
  const originalContractValue = data.contractValue
  const additionalWorksApproved = data.additionalWorks
  const totalContractValue = calculateTotalContractValue(originalContractValue, additionalWorksApproved)
  
  const expectedMarginPercent = data.expectedMarginPercent
  const expectedProfitAmount = calculateExpectedProfit(totalContractValue, expectedMarginPercent)
  const stageBudget = calculateStageBudget(totalContractValue, expectedProfitAmount)
  
  const totalExpenses = data.totalExpenses
  const remainingBudget = calculateRemainingBudget(totalContractValue, totalExpenses)
  const budgetUsagePercent = calculateBudgetUsagePercent(totalExpenses, totalContractValue)
  
  const totalClientPaymentsReceived = data.totalClientPaymentsReceived
  const totalClientPaymentsPending = data.totalClientPaymentsPending
  const totalVendorPaymentsDue = data.totalVendorPaymentsDue
  const totalVendorPaymentsPaid = data.totalVendorPaymentsPaid
  
  const currentCashflow = calculateCurrentCashflow(totalClientPaymentsReceived, totalExpenses)
  const currentProfit = calculateCurrentProfit(totalClientPaymentsReceived, totalExpenses)
  const projectedProfit = calculateProjectedProfit(totalContractValue, totalExpenses)
  
  const completionPercent = data.milestones 
    ? calculateCompletionPercent(data.milestones) 
    : 0
  
  const cashflowStatus = determineCashflowStatus(currentCashflow, budgetUsagePercent, completionPercent)
  
  const overbudgetStages = data.milestones ? getOverbudgetStages(data.milestones) : []
  const isOverBudget = checkIsOverBudget(budgetUsagePercent, completionPercent, overbudgetStages.length)
  const hasCashflowRisk = checkHasCashflowRisk(
    currentCashflow, 
    totalClientPaymentsReceived, 
    totalExpenses,
    false, // These would come from actual data
    false
  )
  
  return {
    originalContractValue,
    additionalWorksApproved,
    totalContractValue,
    expectedMarginPercent,
    expectedProfitAmount,
    stageBudget,
    totalExpenses,
    remainingBudget,
    budgetUsagePercent,
    totalClientPaymentsReceived,
    totalClientPaymentsPending,
    totalVendorPaymentsDue,
    totalVendorPaymentsPaid,
    currentCashflow,
    cashflowStatus,
    currentProfit,
    projectedProfit,
    completionPercent,
    isOverBudget,
    hasCashflowRisk
  }
}

// =============================================================================
// AGGREGATE CALCULATIONS (for Admin dashboard)
// =============================================================================

/**
 * Calculate company-wide totals from multiple projects
 */
export function calculateCompanyTotals(projects: ProjectFinancialData[]): {
  totalContractValue: number
  totalExpectedProfit: number
  totalProjectedProfit: number
  totalReceivables: number
  totalPayables: number
  currentCashflow: number
  projectCount: number
  activeProjectCount: number
  atRiskCount: number
} {
  let totalContractValue = 0
  let totalExpectedProfit = 0
  let totalProjectedProfit = 0
  let totalReceivables = 0
  let totalPayables = 0
  let totalReceived = 0
  let totalExpenses = 0
  let atRiskCount = 0
  
  projects.forEach(project => {
    const metrics = calculateProjectMetrics(project)
    totalContractValue += metrics.totalContractValue
    totalExpectedProfit += metrics.expectedProfitAmount
    totalProjectedProfit += metrics.projectedProfit
    totalReceivables += project.totalClientPaymentsPending
    totalPayables += project.totalVendorPaymentsDue
    totalReceived += project.totalClientPaymentsReceived
    totalExpenses += project.totalExpenses
    
    if (metrics.isOverBudget || metrics.hasCashflowRisk) {
      atRiskCount++
    }
  })
  
  return {
    totalContractValue,
    totalExpectedProfit,
    totalProjectedProfit,
    totalReceivables,
    totalPayables,
    currentCashflow: totalReceived - totalExpenses,
    projectCount: projects.length,
    activeProjectCount: projects.length, // Would need status field
    atRiskCount
  }
}

// =============================================================================
// FORM CALCULATIONS (for Create/Edit Project forms)
// =============================================================================

/**
 * Calculate form summary values for project creation/editing
 * Uses same core functions for consistency
 */
export function calculateFormSummary(
  contractValue: string,
  additionalWorks: string,
  expectedMargin: string
): {
  totalContractValue: number
  expectedProfitAmount: number
  stageBudget: number
} {
  const contract = parseFloat(contractValue) || 0
  const additional = parseFloat(additionalWorks) || 0
  const margin = parseFloat(expectedMargin) || 0
  
  const total = calculateTotalContractValue(contract, additional)
  const profit = calculateExpectedProfit(total, margin)
  const budget = calculateStageBudget(total, profit)
  
  return {
    totalContractValue: total,
    expectedProfitAmount: profit,
    stageBudget: budget
  }
}
