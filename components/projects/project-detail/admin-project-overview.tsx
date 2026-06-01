"use client"

import { useMemo } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  Receipt,
  CreditCard,
  CalendarClock,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/currency"
import { calculateCompletionPercent, type MilestoneData } from "@/lib/financial-calculations"
import { summarizeProjectFinancialLayers } from "@/lib/dashboard-financials"
import {
  DashboardSection,
  HealthBadge,
  MetricTile,
} from "@/components/dashboard/financial-layers"
import {
  buildReceivedTimelineLines,
  buildRemainingBudgetTimelineLines,
  buildSpentTimelineLines,
  deriveProjectTimeline,
} from "@/lib/project-timeline"

interface Milestone {
  id?: string
  name: string
  expectedCostPercent: number
  actualCompletionPercent: number
  targetBudget: number
  actualExpenses: number
  status?: string
}

interface ActivityItem {
  id: string
  type: "expense" | "payment_received" | "payment_due"
  title: string
  subtitle: string
  amount: number
  date: string
}

interface AlertItem {
  id: string
  title: string
  subtitle: string
  amount?: number
  dueLabel: string
  tone: "warning" | "danger" | "info"
}

interface AdminProjectOverviewProps {
  projectData: {
    originalContractValue: number
    additionalWorksApproved: number
    expectedProfitPercent: number
    totalExpenses: number
    totalClientPaymentsReceived: number
    milestones: Milestone[]
    unpaidVendorBills: { vendorName: string; amount: number; overdueDays: number }[]
    delayedClientPayments: { milestone: string; amount: number; overdueDays: number }[]
    pendingApprovals: { id: string; description: string; amount: number }[]
    recentActivity: ActivityItem[]
    startDate?: string | null
    expectedCompletionDate?: string | null
    expenseDates?: string[]
    paymentReceivedDates?: string[]
  }
}

function getStageStatusBadge(status?: string, completionPercent?: number) {
  if (status === "completed" || completionPercent === 100) {
    return (
      <Badge className="bg-success/15 text-success border-success/30 text-xs">Completed</Badge>
    )
  }
  if (status === "in-progress" || (completionPercent && completionPercent > 0)) {
    return (
      <Badge className="bg-primary/15 text-primary border-primary/30 text-xs">In Progress</Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Pending
    </Badge>
  )
}

export function AdminProjectOverview({ projectData }: AdminProjectOverviewProps) {
  const milestonesForCalc: MilestoneData[] = projectData.milestones.map((ms) => ({
    name: ms.name,
    expectedCostPercent: ms.expectedCostPercent,
    actualCompletionPercent: ms.actualCompletionPercent,
    targetBudget: ms.targetBudget,
    actualExpenses: ms.actualExpenses,
    status:
      ms.status ??
      (ms.actualCompletionPercent === 100
        ? "completed"
        : ms.actualCompletionPercent > 0
          ? "in-progress"
          : "pending"),
  }))

  const financials = summarizeProjectFinancialLayers({
    contractValue: projectData.originalContractValue,
    additionalWorksApproved: projectData.additionalWorksApproved,
    expectedMarginPercent: projectData.expectedProfitPercent,
    totalExpenses: projectData.totalExpenses,
    totalReceived: projectData.totalClientPaymentsReceived,
    milestones: milestonesForCalc,
  })

  const timeline = useMemo(
    () =>
      deriveProjectTimeline({
        startDate: projectData.startDate,
        expectedCompletionDate: projectData.expectedCompletionDate,
        expenseDates: projectData.expenseDates,
        paymentReceivedDates: projectData.paymentReceivedDates,
      }),
    [
      projectData.startDate,
      projectData.expectedCompletionDate,
      projectData.expenseDates,
      projectData.paymentReceivedDates,
    ],
  )

  const spentTimelineLines = useMemo(
    () => buildSpentTimelineLines(timeline),
    [timeline],
  )
  const receivedTimelineLines = useMemo(
    () => buildReceivedTimelineLines(timeline),
    [timeline],
  )
  const remainingBudgetTimelineLines = useMemo(
    () => buildRemainingBudgetTimelineLines(timeline),
    [timeline],
  )

  const completionPercent = calculateCompletionPercent(milestonesForCalc)

  const stageRows = useMemo(() => {
    return projectData.milestones.map((stage) => {
      const isCompleted =
        stage.status === "completed" || stage.actualCompletionPercent === 100
      const profitLoss = isCompleted ? stage.targetBudget - stage.actualExpenses : null
      return { ...stage, profitLoss, isCompleted }
    })
  }, [projectData.milestones])

  const currentStage =
    projectData.milestones.find((ms) => ms.status === "in-progress") ??
    projectData.milestones.find(
      (ms) => ms.actualCompletionPercent > 0 && ms.actualCompletionPercent < 100,
    ) ??
    projectData.milestones.find(
      (ms) => ms.status !== "completed" && ms.actualCompletionPercent < 100,
    )

  const currentStageIndex = currentStage
    ? projectData.milestones.findIndex((ms) => ms.name === currentStage.name)
    : -1

  const upcomingAlerts: AlertItem[] = useMemo(() => {
    const alerts: AlertItem[] = []

    if (financials.cashBalance < 0) {
      alerts.push({
        id: "cash-negative",
        title: "Cash balance negative",
        subtitle: "Spent more than received from client",
        dueLabel: "Review collections and spend",
        tone: "danger",
      })
    }

    projectData.delayedClientPayments.slice(0, 2).forEach((payment, index) => {
      alerts.push({
        id: `client-${index}`,
        title: "Payment due",
        subtitle: payment.milestone,
        amount: payment.amount,
        dueLabel:
          payment.overdueDays > 0
            ? `Overdue ${payment.overdueDays} days`
            : "Due soon",
        tone: payment.overdueDays > 0 ? "danger" : "warning",
      })
    })

    if (projectData.pendingApprovals.length > 0) {
      alerts.push({
        id: "pm-approval",
        title: "Expense approval pending",
        subtitle: `${projectData.pendingApprovals.length} item(s) waiting`,
        dueLabel: "Action required",
        tone: "warning",
      })
    }

    if (financials.remainingStageBudget < 0) {
      alerts.push({
        id: "over-budget",
        title: "Over stage budget",
        subtitle: "Approved spend exceeds planned construction pot",
        dueLabel: "Review expenses",
        tone: "danger",
      })
    }

    return alerts.slice(0, 4)
  }, [projectData, financials.cashBalance, financials.remainingStageBudget])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-medium text-foreground">Project financial health</p>
          <p className="text-xs text-muted-foreground">
            Plan, stage results, and cash are shown separately
          </p>
        </div>
        <HealthBadge health={financials.health} />
      </div>

      <DashboardSection
        layer="plan"
        title="Contract & fixed profit (plan)"
        description="Target margin is reserved at setup — not cash in hand until the job completes successfully."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Total contract value"
            value={formatINR(financials.totalContractValue)}
            hint="Original contract + approved additional works"
          />
          <MetricTile
            label="Fixed profit (reserved)"
            value={formatINR(financials.plannedProfit)}
            hint={`${projectData.expectedProfitPercent}% of contract — do not spend`}
            valueClassName="text-success"
          />
          <MetricTile
            label="Total stage budget"
            value={formatINR(financials.totalStageBudget)}
            hint="Maximum planned spend on construction"
            valueClassName="text-primary"
          />
          <MetricTile
            label="Remaining stage budget"
            value={formatINR(financials.remainingStageBudget)}
            hint={`${financials.budgetUsagePercent}% of stage budget used`}
            timelineLines={remainingBudgetTimelineLines}
            valueClassName={
              financials.remainingStageBudget >= 0 ? "text-foreground" : "text-destructive"
            }
          />
        </div>
      </DashboardSection>

      <DashboardSection
        layer="cash"
        title="Cash position"
        description="Based on payments actually received from the client — use this for day-to-day spending decisions."
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricTile
            label="Received from client"
            value={formatINR(projectData.totalClientPaymentsReceived)}
            hint={`${financials.receivedPercent}% of contract collected`}
            timelineLines={receivedTimelineLines}
            valueClassName="text-success"
          />
          <MetricTile
            label="Spent (approved)"
            value={formatINR(projectData.totalExpenses)}
            hint="Approved site expenses to date"
            timelineLines={spentTimelineLines}
          />
          <MetricTile
            label="Cash balance"
            value={formatINR(financials.cashBalance)}
            hint="Received − spent (not project profit)"
            valueClassName={
              financials.cashBalance >= 0 ? "text-success" : "text-destructive"
            }
          />
          <MetricTile
            label="Balance to collect"
            value={formatINR(financials.balanceToCollect)}
            hint="Contract value still due from client"
            valueClassName="text-primary"
          />
        </div>
      </DashboardSection>

      <div className="grid gap-6 lg:grid-cols-5">
        <DashboardSection
          layer="stage"
          title="Stage summary"
          description="Profit or loss only for completed stages — real result per phase."
          className="lg:col-span-2"
        >
          <div className="overflow-x-auto rounded-md border border-border text-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-9">Stage</TableHead>
                  <TableHead className="h-9 text-right">Profit / Loss</TableHead>
                  <TableHead className="h-9 text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stageRows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="py-2 font-medium">{row.name}</TableCell>
                    <TableCell
                      className={cn(
                        "py-2 text-right font-medium tabular-nums",
                        row.profitLoss === null
                          ? "text-muted-foreground"
                          : row.profitLoss >= 0
                            ? "text-success"
                            : "text-destructive",
                      )}
                    >
                      {row.profitLoss !== null
                        ? `${row.profitLoss >= 0 ? "+" : ""}${formatINR(row.profitLoss)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      {getStageStatusBadge(row.status, row.actualCompletionPercent)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell className="py-2">Completed stages total</TableCell>
                  <TableCell
                    className={cn(
                      "py-2 text-right tabular-nums",
                      financials.completedStageProfitLoss >= 0
                        ? "text-success"
                        : "text-destructive",
                    )}
                  >
                    {financials.completedStageProfitLoss >= 0 ? "+" : ""}
                    {formatINR(financials.completedStageProfitLoss)}
                  </TableCell>
                  <TableCell className="py-2" />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </DashboardSection>

        <Card className="dashboard-card border-border lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base font-semibold">Current stage progress</CardTitle>
              <Badge variant="outline" className="text-[10px] uppercase">Plan</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStage ? (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-lg font-semibold">{currentStage.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Overall progress {completionPercent}%
                    </p>
                  </div>
                  {getStageStatusBadge(currentStage.status, currentStage.actualCompletionPercent)}
                </div>
                <Progress value={currentStage.actualCompletionPercent} className="h-2" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Stage budget</p>
                    <p className="font-semibold tabular-nums">
                      {formatINR(currentStage.targetBudget)}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Stage spent</p>
                    <p className="font-semibold tabular-nums">
                      {formatINR(currentStage.actualExpenses)}
                    </p>
                  </div>
                </div>
                {(projectData.startDate || projectData.expectedCompletionDate) && (
                  <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                    {projectData.startDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Start {format(new Date(projectData.startDate), "MMM d, yyyy")}
                      </span>
                    )}
                    {projectData.expectedCompletionDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Target{" "}
                        {format(new Date(projectData.expectedCompletionDate), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {projectData.milestones.map((stage, index) => {
                    const isDone =
                      stage.status === "completed" || stage.actualCompletionPercent === 100
                    const isCurrent = index === currentStageIndex
                    return (
                      <div
                        key={stage.name}
                        className="flex min-w-[72px] flex-col items-center gap-1"
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                            isDone && "border-success/40 bg-success/15 text-success",
                            isCurrent && "border-primary/40 bg-primary/15 text-primary",
                            !isDone &&
                              !isCurrent &&
                              "border-border bg-muted/30 text-muted-foreground",
                          )}
                        >
                          {isDone ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : isCurrent ? (
                            <Clock className="h-4 w-4" />
                          ) : (
                            index + 1
                          )}
                        </div>
                        <span className="max-w-[72px] truncate text-[10px] text-muted-foreground">
                          {stage.name.split(" ")[0]}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                <Circle className="mb-2 h-8 w-8 opacity-40" />
                No active stage yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="dashboard-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Recent activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectData.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent activity</p>
            ) : (
              projectData.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-background p-2 border border-border">
                      {item.type === "payment_received" ? (
                        <CreditCard className="h-4 w-4 text-success" />
                      ) : (
                        <Receipt className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(item.date), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      item.type === "payment_received" ? "text-success" : "text-foreground",
                    )}
                  >
                    {item.type === "payment_received" ? "+" : ""}
                    {formatINR(item.amount)}
                  </p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="dashboard-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAlerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-success/25 bg-success/10 p-4">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-success">All clear</p>
                  <p className="text-xs text-muted-foreground">No alerts right now</p>
                </div>
              </div>
            ) : (
              upcomingAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={cn(
                    "rounded-lg border p-3",
                    alert.tone === "danger" && "border-destructive/30 bg-destructive/5",
                    alert.tone === "warning" && "border-yellow-500/30 bg-yellow-500/5",
                    alert.tone === "info" && "border-primary/30 bg-primary/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.subtitle}</p>
                    </div>
                    {alert.amount !== undefined && (
                      <p className="text-sm font-semibold tabular-nums">
                        {formatINR(alert.amount)}
                      </p>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {alert.dueLabel}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
