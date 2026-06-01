"use client"

import { useMemo } from "react"
import { format, formatDistanceToNow } from "date-fns"
import {
  TrendingUp,
  TrendingDown,
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
import {
  calculateTotalContractValue,
  calculateExpectedProfit,
  calculateStageBudget,
  calculateRemainingBudget,
  calculateCompletionPercent,
  calculateCurrentProfit,
  type MilestoneData,
} from "@/lib/financial-calculations"

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
  }
}

function profitPercent(value: number, contractValue: number) {
  if (contractValue <= 0) return 0
  return Math.round((value / contractValue) * 1000) / 10
}

function getStageStatusBadge(status?: string, completionPercent?: number) {
  if (status === "completed" || completionPercent === 100) {
    return (
      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">
        Completed
      </Badge>
    )
  }
  if (status === "in-progress" || (completionPercent && completionPercent > 0)) {
    return (
      <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 text-xs">
        In Progress
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="text-xs text-muted-foreground">
      Pending
    </Badge>
  )
}

export function AdminProjectOverview({ projectData }: AdminProjectOverviewProps) {
  const totalContractValue = calculateTotalContractValue(
    projectData.originalContractValue,
    projectData.additionalWorksApproved,
  )
  const expectedProfitAmount = calculateExpectedProfit(
    totalContractValue,
    projectData.expectedProfitPercent,
  )
  const totalStageBudget = calculateStageBudget(totalContractValue, expectedProfitAmount)
  const remainingStageBudget = calculateRemainingBudget(totalStageBudget, projectData.totalExpenses)
  const balanceToCollect = totalContractValue - projectData.totalClientPaymentsReceived
  const actualProfitTillDate = calculateCurrentProfit(
    projectData.totalClientPaymentsReceived,
    projectData.totalExpenses,
  )
  const totalProfitCombined = expectedProfitAmount + Math.max(0, actualProfitTillDate)
  const profitOnTrack = actualProfitTillDate >= 0 && remainingStageBudget >= 0

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

  const completionPercent = calculateCompletionPercent(milestonesForCalc)

  const stageRows = useMemo(() => {
    return projectData.milestones.map((stage) => {
      const isCompleted =
        stage.status === "completed" || stage.actualCompletionPercent === 100
      const profitLoss = isCompleted ? stage.targetBudget - stage.actualExpenses : null

      return {
        ...stage,
        profitLoss,
        isCompleted,
      }
    })
  }, [projectData.milestones])

  const totalStageProfit = stageRows.reduce(
    (sum, row) => sum + (row.profitLoss ?? 0),
    0,
  )

  const currentStage =
    projectData.milestones.find((ms) => ms.status === "in-progress") ??
    projectData.milestones.find(
      (ms) => ms.actualCompletionPercent > 0 && ms.actualCompletionPercent < 100,
    ) ??
    projectData.milestones.find((ms) => ms.status !== "completed" && ms.actualCompletionPercent < 100)

  const currentStageIndex = currentStage
    ? projectData.milestones.findIndex((ms) => ms.name === currentStage.name)
    : -1

  const upcomingAlerts: AlertItem[] = useMemo(() => {
    const alerts: AlertItem[] = []

    projectData.delayedClientPayments.slice(0, 2).forEach((payment, index) => {
      alerts.push({
        id: `client-${index}`,
        title: "Next Payment Due",
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
        title: "PM Approval Pending",
        subtitle: `${projectData.pendingApprovals.length} expense(s) waiting`,
        dueLabel: "Action required",
        tone: "warning",
      })
    }

    const nextStage = projectData.milestones.find(
      (ms) => ms.status === "pending" && ms.actualCompletionPercent === 0,
    )
    if (nextStage) {
      alerts.push({
        id: "next-milestone",
        title: "Next Milestone",
        subtitle: nextStage.name,
        dueLabel: "Upcoming",
        tone: "info",
      })
    }

    return alerts.slice(0, 3)
  }, [projectData.delayedClientPayments, projectData.pendingApprovals, projectData.milestones])

  return (
    <div className="space-y-6">
      <Card className="dashboard-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Project Profit Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Expected Profit
              </p>
              <p className="mt-2 text-2xl font-bold text-success">
                {formatINR(expectedProfitAmount)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {profitPercent(expectedProfitAmount, totalContractValue)}% of contract value
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actual Profit (Till Date)
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold",
                  actualProfitTillDate >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {formatINR(actualProfitTillDate)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {profitPercent(actualProfitTillDate, totalContractValue)}% of contract value
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Received − spent (cash position)
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total Profit (Expected + Actual)
              </p>
              <p className="mt-2 text-2xl font-bold text-success">
                {formatINR(totalProfitCombined)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {profitPercent(totalProfitCombined, totalContractValue)}% of contract value
              </p>
            </div>
            <div
              className={cn(
                "rounded-xl border p-4",
                profitOnTrack
                  ? "border-success/30 bg-success/10"
                  : "border-destructive/30 bg-destructive/10",
              )}
            >
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Profit Status
              </p>
              <div className="mt-2 flex items-center gap-2">
                {profitOnTrack ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
                <p
                  className={cn(
                    "text-xl font-bold",
                    profitOnTrack ? "text-success" : "text-destructive",
                  )}
                >
                  {profitOnTrack ? "On Track" : "At Risk"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-muted/10 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Contract Value</p>
              <p className="text-lg font-semibold">{formatINR(totalContractValue)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Cost (Till Date)</p>
              <p className="text-lg font-semibold">{formatINR(projectData.totalExpenses)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance to Spend</p>
              <p
                className={cn(
                  "text-lg font-semibold",
                  remainingStageBudget >= 0 ? "text-foreground" : "text-destructive",
                )}
              >
                {formatINR(remainingStageBudget)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Balance to Collect</p>
              <p className="text-lg font-semibold text-primary">{formatINR(balanceToCollect)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="dashboard-card border-border lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Stage Summary</CardTitle>
            <p className="text-xs text-muted-foreground">
              Profit or loss shown only for completed stages
            </p>
          </CardHeader>
          <CardContent className="pt-0">
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
                          "py-2 text-right font-medium",
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
                    <TableCell className="py-2">Total</TableCell>
                    <TableCell
                      className={cn(
                        "py-2 text-right",
                        totalStageProfit >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {totalStageProfit >= 0 ? "+" : ""}
                      {formatINR(totalStageProfit)}
                    </TableCell>
                    <TableCell className="py-2" />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card className="dashboard-card border-border lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Current Stage Progress</CardTitle>
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
                  <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30">
                    In Progress
                  </Badge>
                </div>
                <Progress value={currentStage.actualCompletionPercent} className="h-2" />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Stage Budget</p>
                    <p className="font-semibold">{formatINR(currentStage.targetBudget)}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Stage Spent</p>
                    <p className="font-semibold">{formatINR(currentStage.actualExpenses)}</p>
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
                        Target {format(new Date(projectData.expectedCompletionDate), "MMM d, yyyy")}
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
                      <div key={stage.name} className="flex min-w-[72px] flex-col items-center gap-1">
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold",
                            isDone && "border-green-500/40 bg-green-500/15 text-green-500",
                            isCurrent && "border-blue-500/40 bg-blue-500/15 text-blue-500",
                            !isDone && !isCurrent && "border-border bg-muted/30 text-muted-foreground",
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
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {projectData.recentActivity.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No recent activity</p>
            ) : (
              projectData.recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/10 p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-0.5 rounded-md bg-background p-2">
                      {item.type === "payment_received" ? (
                        <CreditCard className="h-4 w-4 text-green-500" />
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
                      "shrink-0 text-sm font-semibold",
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
            <CardTitle className="text-base font-semibold">Upcoming / Alerts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingAlerts.length === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <div>
                  <p className="text-sm font-medium text-success">All clear</p>
                  <p className="text-xs text-muted-foreground">No upcoming alerts right now</p>
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
                    alert.tone === "info" && "border-blue-500/30 bg-blue-500/5",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground">{alert.subtitle}</p>
                    </div>
                    {alert.amount !== undefined && (
                      <p className="text-sm font-semibold">{formatINR(alert.amount)}</p>
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
