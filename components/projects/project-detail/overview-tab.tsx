"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Clock,
  CreditCard,
  FileWarning,
  CheckCircle2,
  Activity,
  Milestone,
  CalendarClock,
  Receipt,
  Loader2,
  XCircle,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/currency"
import { TooltipProvider } from "@/components/ui/tooltip"
import { updateExpenseStatusAction } from "@/lib/projects/tab-actions"
import { toast } from "sonner"
import type { ExpenseStatus } from "@/lib/types/database"
import {
  calculateTotalContractValue,
  calculateExpectedProfit,
  calculateStageBudget,
  calculateBudgetUsagePercent,
  calculateCurrentCashflow,
  calculateCompletionPercent,
  getOverbudgetStages,
  type MilestoneData
} from "@/lib/financial-calculations"
import { AdminProjectOverview } from "./admin-project-overview"
import type { ProjectIdleStatus } from "@/lib/project-idle"

const EXPENSE_LIST_PREVIEW_LIMIT = 15

interface Milestone {
  id?: string
  name: string
  expectedCostPercent: number
  actualCompletionPercent: number
  status?: string
  targetBudget: number
  actualExpenses: number
}

interface ActivityItem {
  id: string
  type: "expense" | "payment_received" | "payment_due"
  title: string
  subtitle: string
  amount: number
  date: string
}

interface VendorPayable {
  vendorName: string
  amount: number
  dueDate: string
  overdueDays: number
}

interface ClientPaymentDue {
  milestone: string
  amount: number
  dueDate: string
  overdueDays: number
}

interface ExpenseApprovalItem {
  id: string
  type: string
  description: string
  category: string
  amount: number
  requestedBy: string
  date: string
  status: ExpenseStatus
}

interface OverviewTabProps {
  projectId: string
  projectData: {
    originalContractValue: number
    additionalWorksApproved: number
    expectedProfitPercent: number
    totalExpenses: number
    totalClientPaymentsReceived: number
    totalVendorPaymentsPending: number
    milestones: Milestone[]
    unpaidVendorBills: VendorPayable[]
    delayedClientPayments: ClientPaymentDue[]
    pendingApprovals: ExpenseApprovalItem[]
    expenseApprovals: ExpenseApprovalItem[]
    recentActivity?: ActivityItem[]
    startDate?: string | null
    expectedCompletionDate?: string | null
    expenseDates?: string[]
    paymentReceivedDates?: string[]
    idleStatus?: ProjectIdleStatus | null
  }
  restrictFinancials?: boolean
  canApproveExpenses?: boolean
  onExpenseStatusChange?: () => void
}

function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  switch (status) {
    case "approved":
      return (
        <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
          Approved
        </Badge>
      )
    case "rejected":
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-xs">
          Rejected
        </Badge>
      )
    default:
      return (
        <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 text-xs">
          Pending
        </Badge>
      )
  }
}

export function OverviewTab({
  projectId,
  projectData,
  restrictFinancials = false,
  canApproveExpenses = false,
  onExpenseStatusChange,
}: OverviewTabProps) {
  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showAllExpenseApprovals, setShowAllExpenseApprovals] = useState(false)
  // Use centralized calculations
  const originalContractValue = projectData.originalContractValue
  const additionalWorksApproved = projectData.additionalWorksApproved
  const expectedProfitPercent = projectData.expectedProfitPercent
  const totalExpenses = projectData.totalExpenses
  const totalClientPaymentsReceived = projectData.totalClientPaymentsReceived
  
  // Use centralized calculation functions
  const totalContractValue = calculateTotalContractValue(originalContractValue, additionalWorksApproved)
  const expectedProfitAmount = calculateExpectedProfit(totalContractValue, expectedProfitPercent)
  const totalStageBudget = calculateStageBudget(totalContractValue, expectedProfitAmount)
  
  // Convert milestones to centralized format for calculations
  const milestonesForCalc: MilestoneData[] = projectData.milestones.map(ms => ({
    name: ms.name,
    expectedCostPercent: ms.expectedCostPercent,
    actualCompletionPercent: ms.actualCompletionPercent,
    targetBudget: ms.targetBudget,
    actualExpenses: ms.actualExpenses,
    status: ms.status ?? (ms.actualCompletionPercent === 100 ? "completed" : ms.actualCompletionPercent > 0 ? "in-progress" : "pending")
  }))
  
  // Use centralized overbudget check
  const overbudgetStages = getOverbudgetStages(milestonesForCalc)
  
  // Get alerts data
  const unpaidVendorBills = projectData.unpaidVendorBills || []
  const delayedClientPayments = projectData.delayedClientPayments || []
  const pendingApprovals = projectData.pendingApprovals || []
  const expenseApprovals = projectData.expenseApprovals || []
  const visibleExpenseApprovals = useMemo(
    () =>
      showAllExpenseApprovals
        ? expenseApprovals
        : expenseApprovals.slice(0, EXPENSE_LIST_PREVIEW_LIMIT),
    [expenseApprovals, showAllExpenseApprovals],
  )
  const hiddenExpenseApprovalCount = Math.max(
    0,
    expenseApprovals.length - EXPENSE_LIST_PREVIEW_LIMIT,
  )
  const showExpenseApprovals =
    expenseApprovals.length > 0 && (canApproveExpenses || restrictFinancials)

  useEffect(() => {
    setShowAllExpenseApprovals(false)
  }, [expenseApprovals.length, projectId])

  async function handleExpenseStatus(expenseId: string, status: ExpenseStatus) {
    setProcessingId(expenseId)
    try {
      const result = await updateExpenseStatusAction({
        projectId,
        expenseId,
        status,
      })
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(
        status === "approved"
          ? "Expense approved"
          : status === "rejected"
            ? "Expense rejected"
            : "Expense status updated",
      )
      onExpenseStatusChange?.()
    } finally {
      setProcessingId(null)
    }
  }
  
  // Count critical items
  const overdueVendorBills = unpaidVendorBills.filter(v => v.overdueDays > 0)
  const overdueClientPayments = delayedClientPayments.filter(c => c.overdueDays > 0)
  const pendingInAttention = canApproveExpenses ? 0 : pendingApprovals.length
  const engineerAttentionCount = pendingInAttention
  const totalAttentionItems = restrictFinancials
    ? engineerAttentionCount
    : overdueVendorBills.length +
      overdueClientPayments.length +
      overbudgetStages.length +
      pendingInAttention
  
  // Use centralized calculations
  const stageBudgetUsagePercent = calculateBudgetUsagePercent(totalExpenses, totalStageBudget)
  const completionPercent = calculateCompletionPercent(milestonesForCalc)
  
  // Cashflow balance
  const cashflowBalance = calculateCurrentCashflow(totalClientPaymentsReceived, totalExpenses)
  
  // Milestone counts
  const completedMilestones = projectData.milestones.filter(ms => ms.actualCompletionPercent === 100).length
  const totalMilestones = projectData.milestones.length
  const inProgressMilestones = projectData.milestones.filter(ms => ms.actualCompletionPercent > 0 && ms.actualCompletionPercent < 100).length
  
  // Project Health Logic (AI/Business Logic Driven)
  const determineProjectHealth = () => {
    if (restrictFinancials) {
      if (completionPercent >= 100) {
        return {
          status: "Completed",
          color: "green" as const,
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          description: "All milestones completed",
        }
      }
      if (inProgressMilestones > 0) {
        return {
          status: "In Progress",
          color: "green" as const,
          bgColor: "bg-green-500/10",
          borderColor: "border-green-500/30",
          description: `${inProgressMilestones} stage(s) currently active`,
        }
      }
      return {
        status: "Not Started",
        color: "yellow" as const,
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/30",
        description: "Waiting for site work to begin",
      }
    }

    // Check for overbudget conditions
    const isOverBudget = stageBudgetUsagePercent > completionPercent + 15
    const hasOverbudgetStages = overbudgetStages.length > 0
    
    // Check for cashflow risk
    const hasCashflowRisk = cashflowBalance < 0 || (overdueClientPayments.length > 0 && overdueVendorBills.length > 0)
    const hasNegativeCashflow = totalClientPaymentsReceived < totalExpenses * 0.7
    
    // Check for delays
    const hasDelayedPayments = overdueClientPayments.length > 0
    
    if (isOverBudget || hasOverbudgetStages) {
      return {
        status: "Over Budget",
        color: "destructive" as const,
        bgColor: "bg-destructive/10",
        borderColor: "border-destructive/30",
        description: hasOverbudgetStages 
          ? `${overbudgetStages.length} stage(s) exceeded budget`
          : "Spending ahead of project progress",
      }
    }
    
    if (hasCashflowRisk || hasNegativeCashflow) {
      return {
        status: "Cashflow Risk",
        color: "yellow" as const,
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/30",
        description: hasDelayedPayments 
          ? "Client payments overdue" 
          : "Low cash reserves",
      }
    }
    
    return {
      status: "On Track",
      color: "green" as const,
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/30",
      description: "Project progressing well",
    }
  }
  
  const projectHealth = determineProjectHealth()
  
  // Timeline health
  const timelineHealth = restrictFinancials
    ? completedMilestones === totalMilestones && totalMilestones > 0
      ? "Completed"
      : inProgressMilestones > 0
        ? "On Schedule"
        : "Pending"
    : completionPercent >= stageBudgetUsagePercent - 5
      ? "On Schedule"
      : "Behind Schedule"



  return (
    <TooltipProvider>
      <div className="space-y-6">
        {!restrictFinancials && (
          <AdminProjectOverview
            projectData={{
              originalContractValue: projectData.originalContractValue,
              additionalWorksApproved: projectData.additionalWorksApproved,
              expectedProfitPercent: projectData.expectedProfitPercent,
              totalExpenses: projectData.totalExpenses,
              totalClientPaymentsReceived: projectData.totalClientPaymentsReceived,
              milestones: projectData.milestones,
              unpaidVendorBills: projectData.unpaidVendorBills,
              delayedClientPayments: projectData.delayedClientPayments,
              pendingApprovals: projectData.pendingApprovals,
              recentActivity: projectData.recentActivity ?? [],
              startDate: projectData.startDate,
              expectedCompletionDate: projectData.expectedCompletionDate,
              expenseDates: projectData.expenseDates,
              paymentReceivedDates: projectData.paymentReceivedDates,
            }}
          />
        )}

        {/* Engineer / simplified summary */}
        {restrictFinancials && (
        <div className={cn("grid gap-4", "lg:grid-cols-2")}>
          <Card className={cn(
            "lg:row-span-1",
            projectHealth.bgColor,
            projectHealth.borderColor
          )}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Project Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full",
                  projectHealth.color === "green" && "bg-green-500",
                  projectHealth.color === "yellow" && "bg-yellow-500",
                  projectHealth.color === "destructive" && "bg-destructive"
                )} />
                <span className={cn(
                  "text-2xl font-bold",
                  projectHealth.color === "green" && "text-green-500",
                  projectHealth.color === "yellow" && "text-yellow-500",
                  projectHealth.color === "destructive" && "text-destructive"
                )}>
                  {projectHealth.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {projectHealth.description}
              </p>
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground">
                  Based on milestone progress
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Milestone className="h-4 w-4" />
                Completion Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold">{completionPercent}%</span>
                <span className="text-sm text-muted-foreground">complete</span>
              </div>
              <Progress value={completionPercent} className="h-2" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-muted-foreground" />
                  <span className={cn(
                    "font-medium",
                    timelineHealth === "On Schedule" ? "text-green-500" : "text-yellow-500"
                  )}>
                    {timelineHealth}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {completedMilestones}/{totalMilestones} milestones
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
        )}

        {showExpenseApprovals && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                Expense Approvals
                {pendingApprovals.length > 0 && (
                  <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-500">
                    {pendingApprovals.length} pending
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {visibleExpenseApprovals.map((expense) => (
                <div
                  key={expense.id}
                  className={cn(
                    "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border",
                    expense.status === "pending"
                      ? "bg-yellow-500/10 border-yellow-500/20"
                      : expense.status === "approved"
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-muted/30 border-border",
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full shrink-0 mt-2",
                        expense.status === "pending"
                          ? "bg-yellow-500"
                          : expense.status === "approved"
                            ? "bg-green-500"
                            : "bg-muted-foreground",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {expense.category}: {expense.description}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatINR(expense.amount)} | {expense.requestedBy} | {expense.date}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
                    <ExpenseStatusBadge status={expense.status} />
                    {canApproveExpenses && expense.status === "pending" && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          disabled={processingId === expense.id}
                          onClick={() => void handleExpenseStatus(expense.id, "rejected")}
                        >
                          {processingId === expense.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          className="h-8 text-xs"
                          disabled={processingId === expense.id}
                          onClick={() => void handleExpenseStatus(expense.id, "approved")}
                        >
                          {processingId === expense.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {hiddenExpenseApprovalCount > 0 && (
                <div className="pt-1 flex justify-center">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-primary"
                    onClick={() => setShowAllExpenseApprovals((prev) => !prev)}
                  >
                    {showAllExpenseApprovals
                      ? "Show less"
                      : `Show more (${hiddenExpenseApprovalCount} more)`}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Attention Required Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Attention Required
              </div>
              {totalAttentionItems > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {totalAttentionItems} {totalAttentionItems === 1 ? 'Item' : 'Items'}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {totalAttentionItems === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium text-sm text-green-500">All Clear</p>
                  <p className="text-xs text-muted-foreground">No pending issues requiring attention</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {!restrictFinancials && overbudgetStages.map((stage, index) => {
                  const overAmount = stage.actualExpenses - stage.targetBudget
                  return (
                    <div 
                      key={`overbudget-${index}`}
                      className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                        <div>
                          <p className="font-medium text-sm">{stage.name} exceeded budget by {formatINR(overAmount)}</p>
                          <p className="text-xs text-muted-foreground">
                            Target: {formatINR(stage.targetBudget)} | Spent: {formatINR(stage.actualExpenses)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="destructive" className="text-xs">Overbudget</Badge>
                    </div>
                  )
                })}

                {!restrictFinancials && overdueClientPayments.map((payment, index) => (
                  <div 
                    key={`client-${index}`}
                    className="flex items-center justify-between p-3 bg-destructive/10 rounded-lg border border-destructive/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <div>
                        <p className="font-medium text-sm">Client payment overdue {payment.overdueDays} days</p>
                        <p className="text-xs text-muted-foreground">
                          {payment.milestone} - {formatINR(payment.amount)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-destructive" />
                      <Badge variant="destructive" className="text-xs">Overdue</Badge>
                    </div>
                  </div>
                ))}

                {!restrictFinancials && overdueVendorBills.map((vendor, index) => (
                  <div 
                    key={`vendor-${index}`}
                    className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <div>
                        <p className="font-medium text-sm">Vendor payment pending - {vendor.vendorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatINR(vendor.amount)} | Due: {vendor.dueDate}
                          {vendor.overdueDays > 0 && ` (${vendor.overdueDays} days overdue)`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-yellow-500" />
                      <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-500">Pending</Badge>
                    </div>
                  </div>
                ))}

                {!canApproveExpenses &&
                  pendingApprovals.map((approval) => (
                    <div
                      key={approval.id}
                      className="flex items-center justify-between p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-yellow-500" />
                        <div>
                          <p className="font-medium text-sm">
                            {approval.type}: {approval.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatINR(approval.amount)} | Requested by {approval.requestedBy} on{" "}
                            {approval.date}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileWarning className="h-4 w-4 text-yellow-500" />
                        <ExpenseStatusBadge status="pending" />
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  )
}
