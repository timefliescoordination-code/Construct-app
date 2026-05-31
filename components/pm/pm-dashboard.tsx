"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Briefcase,
  TrendingUp,
  IndianRupee,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  ChevronRight,
  Loader2,
  ClipboardList,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { updateExpenseStatusAction } from "@/lib/projects/tab-actions"
import {
  calculateTotalContractValue,
  calculateMilestoneCompletionFromExpenses,
} from "@/lib/financial-calculations"
import type { ProjectWithDetails } from "@/lib/types/database"
import { DashboardHeader } from "@/components/dashboard/header"
import { MetricCard } from "@/components/layout/metric-card"
import {
  CONTENT_SIDEBAR_GRID_CLASS,
  CONTENT_SIDEBAR_MAIN_CLASS,
  PageHeader,
  PageMain,
  PageShell,
  STATS_GRID_CLASS,
} from "@/components/layout/page"
import { ScrollTable } from "@/components/layout/scroll-table"
import { toast } from "sonner"

interface PmProjectRow {
  id: string
  name: string
  client_name: string
  site_address: string
  status: string
  contract_value: number
  expected_margin_percent: number
  milestones: Array<{
    id: string
    name: string
    status: string
    expected_cost_percent: number
    target_budget: number
    actual_completion_percent: number
  }>
  expenses: Array<{
    id: string
    amount: number
    status: string
    description: string
    category: string
    expense_date: string
    milestone_id: string | null
    project_id: string
  }>
  client_payments: Array<{
    id: string
    amount: number
    status: string
  }>
  additional_works: Array<{
    amount: number
    approval_status: string
  }>
}

function mapApiProject(project: ProjectWithDetails): PmProjectRow {
  return {
    id: project.id,
    name: project.name,
    client_name: project.client_name,
    site_address: project.site_address,
    status: project.status,
    contract_value: Number(project.contract_value),
    expected_margin_percent: Number(project.expected_margin_percent),
    milestones: (project.milestones ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      status: m.status,
      expected_cost_percent: Number(m.expected_cost_percent),
      target_budget: Number(m.target_budget),
      actual_completion_percent: Number(m.actual_completion_percent),
    })),
    expenses: (project.expenses ?? []).map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      status: e.status,
      description: e.description,
      category: e.category,
      expense_date: e.expense_date,
      milestone_id: e.milestone_id,
      project_id: e.project_id,
    })),
    client_payments: (project.client_payments ?? []).map((cp) => ({
      id: cp.id,
      amount: Number(cp.amount),
      status: cp.status,
    })),
    additional_works: (project.additional_works ?? []).map((aw) => ({
      amount: Number(aw.amount),
      approval_status: aw.approval_status,
    })),
  }
}

function projectTotalContractValue(project: PmProjectRow): number {
  const additionalWorksApproved = project.additional_works
    .filter((aw) => aw.approval_status === "approved")
    .reduce((sum, aw) => sum + aw.amount, 0)
  return calculateTotalContractValue(project.contract_value, additionalWorksApproved)
}

function milestoneCompletionPercent(
  milestone: PmProjectRow["milestones"][number],
  expenses: PmProjectRow["expenses"],
): number {
  const spent = expenses
    .filter((e) => e.status === "approved" && e.milestone_id === milestone.id)
    .reduce((sum, e) => sum + e.amount, 0)
  return calculateMilestoneCompletionFromExpenses(spent, milestone.target_budget)
}

function projectCompletionPercent(project: PmProjectRow): number {
  if (!project.milestones.length) return 0
  const total = project.milestones.reduce(
    (sum, m) => sum + milestoneCompletionPercent(m, project.expenses),
    0,
  )
  return total / project.milestones.length
}

interface PendingApproval {
  id: string
  type: "expense"
  description: string
  amount: number
  project_name: string
  project_id: string
  date: string
  entered_by_name: string
}

function pendingApprovalsFromProjects(projects: PmProjectRow[]): PendingApproval[] {
  const approvals: PendingApproval[] = []
  for (const project of projects) {
    for (const exp of project.expenses) {
      if (exp.status !== "pending") continue
      approvals.push({
        id: exp.id,
        type: "expense",
        description: `${exp.category} - ${exp.description}`,
        amount: exp.amount,
        project_name: project.name,
        project_id: project.id,
        date: exp.expense_date,
        entered_by_name: "Site Engineer",
      })
    }
  }
  return approvals.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export function PMDashboard() {
  const [projects, setProjects] = useState<PmProjectRow[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setFetchError(null)

    try {
      const res = await fetch("/api/projects", {
        credentials: "include",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: ProjectWithDetails[]
        error?: string
      }

      if (!res.ok) {
        const message =
          typeof json.error === "string"
            ? json.error
            : res.status === 401
              ? "You must be signed in to view the PM dashboard."
              : `Failed to load projects (${res.status}).`
        setFetchError(message)
        setProjects([])
        setPendingApprovals([])
        return
      }

      const rows = (json.data ?? []).map(mapApiProject)
      setProjects(rows)
      setPendingApprovals(pendingApprovalsFromProjects(rows))
    } catch (err) {
      console.error("PM dashboard load error:", err)
      setFetchError(
        err instanceof Error ? err.message : "Failed to load PM dashboard.",
      )
      setProjects([])
      setPendingApprovals([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const pmMetrics = useMemo(() => {
    const totalProjects = projects.length
    const activeProjects = projects.filter((p) => p.status === "active").length
    const completedProjects = projects.filter(
      (p) => p.status === "completed",
    ).length

    const totalContractValue = projects.reduce(
      (sum, p) => sum + projectTotalContractValue(p),
      0,
    )

    const totalExpenses = projects.reduce(
      (sum, p) =>
        sum +
        p.expenses
          .filter((e) => e.status === "approved")
          .reduce((s, e) => s + e.amount, 0),
      0,
    )

    const totalReceived = projects.reduce(
      (sum, p) =>
        sum +
        p.client_payments
          .filter((cp) => cp.status === "received")
          .reduce((s, cp) => s + cp.amount, 0),
      0,
    )

    const avgCompletion =
      projects.length > 0
        ? projects.reduce((sum, p) => sum + projectCompletionPercent(p), 0) /
          projects.length
        : 0

    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalContractValue,
      totalExpenses,
      totalReceived,
      avgCompletion,
      pendingApprovalCount: pendingApprovals.length,
    }
  }, [projects, pendingApprovals])

  async function handleApproveExpense(expenseId: string) {
    const approval = pendingApprovals.find((a) => a.id === expenseId)
    if (!approval) return

    const result = await updateExpenseStatusAction({
      projectId: approval.project_id,
      expenseId,
      status: "approved",
    })

    if (result.ok) {
      toast.success("Expense approved")
      await loadDashboard()
    } else {
      toast.error(result.error)
    }
  }

  async function handleRejectExpense(expenseId: string) {
    const approval = pendingApprovals.find((a) => a.id === expenseId)
    if (!approval) return

    const result = await updateExpenseStatusAction({
      projectId: approval.project_id,
      expenseId,
      status: "rejected",
    })

    if (result.ok) {
      toast.success("Expense rejected")
      await loadDashboard()
    } else {
      toast.error(result.error)
    }
  }

  if (isLoading) {
    return (
      <PageShell>
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your projects...</p>
          </div>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <DashboardHeader notificationCount={pmMetrics.pendingApprovalCount} />

      <PageMain>
        <PageHeader
          title="PM Dashboard"
          description={`${format(new Date(), "EEEE, dd MMMM yyyy")} — Managing ${pmMetrics.totalProjects} project${pmMetrics.totalProjects !== 1 ? "s" : ""}`}
        />

        {fetchError && (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="flex items-start gap-3 py-4">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm text-destructive">{fetchError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadDashboard()}
                >
                  Try again
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className={STATS_GRID_CLASS}>
          <MetricCard
            title="My Projects"
            value={pmMetrics.totalProjects}
            description={`${pmMetrics.activeProjects} active, ${pmMetrics.completedProjects} completed`}
            icon={Briefcase}
          />
          <MetricCard
            title="Total Contract Value"
            value={formatINR(pmMetrics.totalContractValue)}
            description="Across all projects"
            icon={IndianRupee}
          />
          <MetricCard
            title="Avg. Completion"
            value={`${pmMetrics.avgCompletion.toFixed(1)}%`}
            description={
              <Progress value={pmMetrics.avgCompletion} className="mt-2 h-2" />
            }
            icon={TrendingUp}
          />
          <MetricCard
            title="Pending Approvals"
            value={pmMetrics.pendingApprovalCount}
            description="Awaiting your action"
            icon={ClipboardList}
            variant={pmMetrics.pendingApprovalCount > 0 ? "warning" : "default"}
            className={cn(
              pmMetrics.pendingApprovalCount > 0 && "border-yellow-500/50",
            )}
            valueClassName={
              pmMetrics.pendingApprovalCount > 0 ? "text-yellow-500" : undefined
            }
          />
        </div>

        <div className={CONTENT_SIDEBAR_GRID_CLASS}>
          <div className={CONTENT_SIDEBAR_MAIN_CLASS}>
            <Card className="section-card">
              <CardHeader>
                <CardTitle>My Projects</CardTitle>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-8">
                    <Briefcase className="h-12 w-12 mx-auto text-muted-foreground/50" />
                    <p className="mt-4 text-muted-foreground">
                      No projects assigned yet
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ask an admin to set you as Project Manager on a project in
                      Edit Project → Staff Assignment.
                    </p>
                  </div>
                ) : (
                  <ScrollTable minWidth="min-w-[36rem]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead>Project</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Progress</TableHead>
                        <TableHead className="text-right">
                          Total Contract Value
                        </TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((project) => {
                        const completion = projectCompletionPercent(project)

                        return (
                          <TableRow key={project.id} className="border-border">
                            <TableCell>
                              <div>
                                <p className="font-medium">{project.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {project.client_name}
                                </p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  project.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {project.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={completion}
                                  className="w-16 h-2"
                                />
                                <span className="text-sm">
                                  {completion.toFixed(0)}%
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {formatINR(projectTotalContractValue(project))}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="sm" asChild>
                                <Link href={`/projects/${project.id}`}>
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                  </ScrollTable>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="min-w-0">
            <Card className="section-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  Pending Approvals
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pendingApprovals.length === 0 ? (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-green-500/50" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      All caught up!
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pendingApprovals.slice(0, 5).map((approval) => (
                      <div
                        key={approval.id}
                        className="p-3 bg-muted/50 rounded-lg space-y-2"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">
                              {approval.description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {approval.project_name}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className="text-yellow-500 border-yellow-500/30"
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            Pending
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">
                            {formatINR(approval.amount)}
                          </span>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() =>
                                void handleRejectExpense(approval.id)
                              }
                            >
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                void handleApproveExpense(approval.id)
                              }
                            >
                              Approve
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {pendingApprovals.length > 5 && (
                      <Button variant="ghost" className="w-full" size="sm">
                        View all {pendingApprovals.length} pending
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}
