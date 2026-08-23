"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { aggregateAdminCompanyMetrics } from "@/lib/admin-dashboard-data"
import { formatINR } from "@/lib/currency"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Briefcase,
  AlertTriangle,
  Users,
  Calendar,
  Wallet,
  Target,
  Layers,
} from "lucide-react"
import {
  DashboardSection,
  HealthBadge,
  MetricTile,
} from "@/components/dashboard/financial-layers"
import Link from "next/link"
import { Plus } from "lucide-react"
import { AddExpenseMenu } from "@/components/finance/add-expense-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAdminDashboard } from "@/lib/hooks/use-admin-dashboard"
import { ProjectIdleBadge } from "@/components/projects/project-idle-badge"
import { PM_NOT_CREATED } from "@/lib/staff-labels"
import { DashboardHeader } from "@/components/dashboard/header"
import {
  PageHeader,
  PageMain,
  PageShell,
  STATS_GRID_CLASS,
  STATS_GRID_3_CLASS,
} from "@/components/layout/page"
import { ScrollTable } from "@/components/layout/scroll-table"
import { MoneyTimelineSection } from "@/components/admin/money-timeline"
import { ProjectMilestoneLink } from "@/components/admin/project-milestone-link"
import { AdminSettingsLinks } from "@/components/admin/admin-settings-links"
import { TooltipProvider } from "@/components/ui/tooltip"
import { useAuth } from "@/lib/hooks/use-auth"

function StatCardSkeleton() {
  return (
    <Card className="card-metric bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-32 mb-2" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  )
}

function MetricSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("card-metric bg-card border-border", className)}>
      <CardContent className="pt-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PmCardSkeleton() {
  return (
    <Card className="card-metric bg-muted/30">
      <CardContent className="pt-4">
        <div className="flex items-center gap-3 mb-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </CardContent>
    </Card>
  )
}

const SHOW_ALL_PROJECTS = "all"

export function AdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("30d")
  const [selectedProjectId, setSelectedProjectId] = useState(SHOW_ALL_PROJECTS)
  const { projects, company, projectManagers, isLoading, error } = useAdminDashboard()
  const { isAdmin, canManageProjects, isLoading: authLoading } = useAuth()
  const showCreateProject = !authLoading && (isAdmin || canManageProjects)

  const projectPickerOptions = useMemo(
    () =>
      projects.map((p) => ({
        id: p.id,
        name: p.name || "Unnamed project",
      })),
    [projects],
  )

  const showAllProjects = selectedProjectId === SHOW_ALL_PROJECTS

  const visibleProjects = useMemo(() => {
    if (showAllProjects) return projects
    return projects.filter((project) => project.id === selectedProjectId)
  }, [projects, selectedProjectId, showAllProjects])

  const displayCompany = useMemo(() => {
    if (!company) return null
    if (showAllProjects) return company
    return aggregateAdminCompanyMetrics(visibleProjects, {
      totalPMs: company.totalPMs,
      totalEngineers: company.totalEngineers,
    })
  }, [company, showAllProjects, visibleProjects])

  const selectedProject = showAllProjects
    ? null
    : projects.find((project) => project.id === selectedProjectId)

  const cashflowWarnings = displayCompany?.cashflowWarnings ?? 0

  const scopeLabel = showAllProjects
    ? `all ${projects.length} project${projects.length === 1 ? "" : "s"}`
    : selectedProject?.name ?? "selected project"

  return (
    <PageShell>
      <DashboardHeader notificationCount={cashflowWarnings} />

      <PageMain>
        <PageHeader
          title="Admin Dashboard"
          description="Portfolio view across plan, stage results, and cash — separate layers, no blended profit"
        >
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full sm:w-[200px] bg-secondary border-border">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SHOW_ALL_PROJECTS}>Show all</SelectItem>
                {projects.map((project, index) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name || `Project ${index + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-full sm:w-[140px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>

            {showCreateProject && (
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href="/projects/new">
                  <Plus className="h-4 w-4" />
                  New Project
                </Link>
              </Button>
            )}

            {isAdmin && !authLoading ? (
              <AddExpenseMenu
                projects={projectPickerOptions}
                variant="outline"
                className="border-border w-full sm:w-auto"
              />
            ) : null}

            <Button variant="outline" className="border-border w-full sm:w-auto">
              <Calendar className="mr-2 h-4 w-4 shrink-0" />
              <span className="truncate">Export Report</span>
            </Button>
        </PageHeader>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error.message}
          </div>
        )}

        <AdminSettingsLinks />

        {!isLoading && displayCompany && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-center gap-3">
                <Briefcase className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">Portfolio snapshot</p>
                  <p className="text-xs text-muted-foreground">
                    {displayCompany.totalProjects} projects · {scopeLabel}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-success border-success/30">
                  {displayCompany.activeProjects} active
                </Badge>
                <Badge variant="outline" className="text-muted-foreground">
                  {displayCompany.completedProjects} completed
                </Badge>
                {isAdmin ? (
                  <Button variant="link" className="h-auto p-0 text-xs" asChild>
                    <Link href="/admin/expenses">View all expenses</Link>
                  </Button>
                ) : null}
              </div>
            </div>

            <DashboardSection
              layer="plan"
              title="Contract & planned margin"
              description="Reserved profit at setup — portfolio contract value and target margin."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricTile
                  label="Total contract value"
                  value={formatINR(displayCompany.totalContractValue)}
                  hint={`Weighted margin target ${displayCompany.weightedMarginPercent}%`}
                />
                <MetricTile
                  label="Fixed profit (reserved)"
                  value={formatINR(displayCompany.totalPlannedProfit)}
                  hint="Sum of per-project planned margin"
                  valueClassName="text-success"
                />
                <MetricTile
                  label="Balance to collect"
                  value={formatINR(displayCompany.totalBalanceToCollect)}
                  hint="Contract value not yet received from clients"
                  valueClassName="text-primary"
                />
              </div>
            </DashboardSection>

            <DashboardSection
              layer="cash"
              title="Portfolio cash"
              description="Received minus spent — operational liquidity, not project profit."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Received from clients"
                  value={formatINR(displayCompany.totalReceived)}
                  hint={`${displayCompany.portfolioReceivedPercent}% of contract collected`}
                  timelineLines={
                    showAllProjects
                      ? displayCompany.portfolioSpentTimelineLines.filter((line) =>
                          line.toLowerCase().includes("payment"),
                        )
                      : selectedProject?.spent_timeline_lines.filter((line) =>
                          line.toLowerCase().includes("payment"),
                        )
                  }
                  valueClassName="text-success"
                />
                <MetricTile
                  label="Spent (approved)"
                  value={formatINR(displayCompany.totalSpent)}
                  hint="Approved expenses across portfolio"
                  timelineLines={
                    showAllProjects
                      ? displayCompany.portfolioSpentTimelineLines
                      : selectedProject?.spent_timeline_lines
                  }
                />
                <MetricTile
                  label="Portfolio cash balance"
                  value={formatINR(displayCompany.portfolioCashBalance)}
                  hint="Received − spent"
                  valueClassName={
                    displayCompany.portfolioCashBalance >= 0
                      ? "text-success"
                      : "text-destructive"
                  }
                />
                <MetricTile
                  label="Pending payables"
                  value={formatINR(displayCompany.totalPayables)}
                  hint="Vendor bills due"
                  valueClassName="text-destructive"
                />
              </div>
            </DashboardSection>

            <DashboardSection
              layer="stage"
              title="Stage results (portfolio)"
              description="Profit or loss from completed stages only — real operational outcomes."
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <MetricTile
                  label="Completed stages P/L"
                  value={
                    <>
                      {displayCompany.totalCompletedStageProfitLoss >= 0 ? "+" : ""}
                      {formatINR(displayCompany.totalCompletedStageProfitLoss)}
                    </>
                  }
                  hint="Sum across all projects"
                  valueClassName={
                    displayCompany.totalCompletedStageProfitLoss >= 0
                      ? "text-success"
                      : "text-destructive"
                  }
                />
                <MetricTile
                  label="Projects with stage loss"
                  value={displayCompany.stageLossProjects}
                  hint="At least one completed stage over budget"
                  valueClassName={
                    displayCompany.stageLossProjects > 0 ? "text-destructive" : undefined
                  }
                />
                <MetricTile
                  label="Over stage budget"
                  value={displayCompany.overbudgetProjects}
                  hint="Spend exceeds planned construction pot"
                  valueClassName={
                    displayCompany.overbudgetProjects > 0 ? "text-destructive" : undefined
                  }
                />
              </div>
            </DashboardSection>
          </section>
        )}

        {isLoading && (
          <section className="space-y-6">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </section>
        )}

        {showAllProjects && !isLoading && projects.length > 0 && (
          <section>
            <Card className="section-card border-border">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Projects</CardTitle>
                  <Layers className="h-4 w-4 text-muted-foreground" />
                </div>
                <CardDescription>
                  Plan, cash, and completed-stage results per project — open a row for full detail.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <ScrollTable
                  className="table-scroll-hint px-4 pb-4 sm:px-6 sm:pb-6"
                  minWidth="min-w-[64rem]"
                >
                  <TooltipProvider delayDuration={200}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Project</TableHead>
                          <TableHead className="text-right">Contract</TableHead>
                          <TableHead className="text-right">Received</TableHead>
                          <TableHead className="text-right">Spent</TableHead>
                          <TableHead className="text-right">Cash balance</TableHead>
                          <TableHead className="text-right">Stage P/L</TableHead>
                          <TableHead>Health</TableHead>
                          <TableHead>Site activity</TableHead>
                          <TableHead>PM</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {projects.map((project, index) => (
                          <TableRow key={project.id}>
                            <TableCell className="font-medium">
                              <div className="flex min-w-[12rem] items-center gap-2.5">
                                <ProjectMilestoneLink
                                  projectId={project.id}
                                  hasStageLoss={project.has_stage_loss}
                                />
                                <Link
                                  href={`/projects/${project.id}`}
                                  className="truncate text-foreground underline-offset-4 hover:text-primary hover:underline"
                                >
                                  {project.name || `Project ${index + 1}`}
                                </Link>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatINR(project.contract_value)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              <span className="text-success">
                                {formatINR(project.total_received)}
                              </span>
                              <span className="block text-[10px] text-muted-foreground">
                                {project.received_percent}%
                              </span>
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-destructive">
                              {formatINR(project.total_expenses)}
                              <span className="block text-[10px] text-muted-foreground">
                                {project.budget_usage_percent}% of stage budget
                              </span>
                              {project.spent_timeline_lines.length > 0 ? (
                                <ul className="mt-1 space-y-0.5 text-left text-[10px] font-normal text-muted-foreground">
                                  {project.spent_timeline_lines.map((line) => (
                                    <li key={line}>{line}</li>
                                  ))}
                                </ul>
                              ) : null}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-medium tabular-nums",
                                project.cash_balance >= 0
                                  ? "text-success"
                                  : "text-destructive",
                              )}
                            >
                              {project.cash_balance >= 0 ? "+" : ""}
                              {formatINR(project.cash_balance)}
                            </TableCell>
                            <TableCell
                              className={cn(
                                "text-right font-medium tabular-nums",
                                project.completed_stage_profit_loss >= 0
                                  ? "text-success"
                                  : "text-destructive",
                              )}
                            >
                              {project.completed_stage_profit_loss >= 0 ? "+" : ""}
                              {formatINR(project.completed_stage_profit_loss)}
                            </TableCell>
                            <TableCell>
                              <HealthBadge health={project.health} />
                            </TableCell>
                            <TableCell>
                              <ProjectIdleBadge idle={project.idle} />
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {project.pm_label}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {project.status.replace("-", " ")}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/40 font-semibold">
                          <TableCell>Portfolio total</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatINR(
                              projects.reduce((sum, p) => sum + p.contract_value, 0),
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-success">
                            {formatINR(
                              projects.reduce((sum, p) => sum + p.total_received, 0),
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-destructive">
                            {formatINR(
                              projects.reduce((sum, p) => sum + p.total_expenses, 0),
                            )}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              projects.reduce((sum, p) => sum + p.cash_balance, 0) >= 0
                                ? "text-success"
                                : "text-destructive",
                            )}
                          >
                            {(() => {
                              const total = projects.reduce(
                                (sum, p) => sum + p.cash_balance,
                                0,
                              )
                              return `${total >= 0 ? "+" : ""}${formatINR(total)}`
                            })()}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right tabular-nums",
                              projects.reduce(
                                (sum, p) => sum + p.completed_stage_profit_loss,
                                0,
                              ) >= 0
                                ? "text-success"
                                : "text-destructive",
                            )}
                          >
                            {(() => {
                              const total = projects.reduce(
                                (sum, p) => sum + p.completed_stage_profit_loss,
                                0,
                              )
                              return `${total >= 0 ? "+" : ""}${formatINR(total)}`
                            })()}
                          </TableCell>
                          <TableCell colSpan={3} />
                        </TableRow>
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                </ScrollTable>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
            Risk &amp; operations
          </h2>
          <div className={STATS_GRID_3_CLASS}>
            {isLoading || !displayCompany ? (
              <>
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </>
            ) : (
              <>
                <Card
                  className={cn(
                    "card-metric",
                    displayCompany.cashRiskProjects > 0
                      ? "border-destructive/30 bg-destructive/5"
                      : "border-border bg-card",
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "rounded-lg p-3",
                          displayCompany.cashRiskProjects > 0
                            ? "bg-destructive/20"
                            : "bg-muted",
                        )}
                      >
                        <Wallet
                          className={cn(
                            "h-6 w-6",
                            displayCompany.cashRiskProjects > 0
                              ? "text-destructive"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold tabular-nums",
                            displayCompany.cashRiskProjects > 0 && "text-destructive",
                          )}
                        >
                          {displayCompany.cashRiskProjects}
                        </p>
                        <p className="text-sm text-muted-foreground">Cash risk projects</p>
                        <p className="text-xs text-muted-foreground">Spent exceeds received</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "card-metric",
                    displayCompany.collectionRiskProjects > 0
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-border bg-card",
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "rounded-lg p-3",
                          displayCompany.collectionRiskProjects > 0
                            ? "bg-yellow-500/20"
                            : "bg-muted",
                        )}
                      >
                        <Target
                          className={cn(
                            "h-6 w-6",
                            displayCompany.collectionRiskProjects > 0
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold tabular-nums",
                            displayCompany.collectionRiskProjects > 0 &&
                              "text-yellow-600 dark:text-yellow-400",
                          )}
                        >
                          {displayCompany.collectionRiskProjects}
                        </p>
                        <p className="text-sm text-muted-foreground">Collection gap</p>
                        <p className="text-xs text-muted-foreground">
                          Low collection vs spend pace
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={
                    displayCompany.cashflowWarnings > 0
                      ? "border-yellow-500/30 bg-yellow-500/5"
                      : "border-border bg-card"
                  }
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "rounded-lg p-3",
                          displayCompany.cashflowWarnings > 0
                            ? "bg-yellow-500/20"
                            : "bg-muted",
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-6 w-6",
                            displayCompany.cashflowWarnings > 0
                              ? "text-yellow-600 dark:text-yellow-400"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold tabular-nums",
                            displayCompany.cashflowWarnings > 0 &&
                              "text-yellow-600 dark:text-yellow-400",
                          )}
                        >
                          {displayCompany.cashflowWarnings}
                        </p>
                        <p className="text-sm text-muted-foreground">Overdue vendor bills</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <section>
          <div className={STATS_GRID_CLASS}>
            {isLoading || !displayCompany ? (
              <MetricSkeleton />
            ) : (
              <Card className="card-metric border-border bg-card">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="rounded-lg bg-muted p-3">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        {displayCompany.totalPMs} / {displayCompany.totalEngineers}
                      </p>
                      <p className="text-sm text-muted-foreground">PMs / site engineers</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle>Project Manager Performance</CardTitle>
              <CardDescription>Overview of PM workload and project health</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className={STATS_GRID_CLASS}>
                  <PmCardSkeleton />
                  <PmCardSkeleton />
                  <PmCardSkeleton />
                  <PmCardSkeleton />
                </div>
              ) : projectManagers.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
                  <p className="text-sm font-medium text-muted-foreground">{PM_NOT_CREATED}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add project managers in User Management to assign them to projects.
                  </p>
                </div>
              ) : (
                <div className={STATS_GRID_CLASS}>
                  {projectManagers
                    .filter((pm) => {
                      const pmName = pm.full_name || pm.email
                      return visibleProjects.some((project) => project.pm_label === pmName)
                    })
                    .map((pm) => {
                    const pmName = pm.full_name || pm.email
                    const assignedProjects = visibleProjects.filter(
                      (project) => project.pm_label === pmName,
                    )
                    const avgCompletion = assignedProjects.length
                      ? Math.round(
                          assignedProjects.reduce((sum, project) => sum + project.progress, 0) /
                            assignedProjects.length
                        )
                      : 0

                    return (
                      <Card key={pm.id} className="bg-muted/30">
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3 mb-3">
                            <Avatar className="h-10 w-10">
                              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                                {pmName.slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{pmName}</p>
                              <p className="text-xs text-muted-foreground">
                                {assignedProjects.length} project
                                {assignedProjects.length === 1 ? "" : "s"}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Assigned Value</span>
                              <span className="font-medium">
                                {formatINR(
                                  assignedProjects.reduce(
                                    (sum, project) => sum + project.contract_value,
                                    0
                                  )
                                )}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Avg. Completion</span>
                              <span className="font-medium">{avgCompletion}%</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <MoneyTimelineSection />
      </PageMain>
    </PageShell>
  )
}
