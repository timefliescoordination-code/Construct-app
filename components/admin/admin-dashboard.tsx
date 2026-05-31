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
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  Building2,
  Users,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react"
import Link from "next/link"
import { Plus } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAdminDashboard } from "@/lib/hooks/use-admin-dashboard"
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
          description="Company-wide financial overview and project management"
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

        {showAllProjects && !isLoading && projects.length > 0 && (
          <section>
            <Card className="section-card">
              <CardHeader>
                <CardTitle>Profit &amp; Loss by Project</CardTitle>
                <CardDescription>
                  Realized profit (collected − spent) and forecast profit (contract − projected cost at completion)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 sm:p-6 sm:pt-0">
                <ScrollTable className="table-scroll-hint px-4 pb-4 sm:px-6 sm:pb-6" minWidth="min-w-[56rem]">
                <TooltipProvider delayDuration={200}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Contract</TableHead>
                      <TableHead className="text-right">Spent</TableHead>
                      <TableHead className="text-right">Received</TableHead>
                      <TableHead className="text-right">Progress</TableHead>
                      <TableHead className="text-right">Realized</TableHead>
                      <TableHead className="text-right">Forecast</TableHead>
                      <TableHead>PM</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects.map((project, index) => (
                      <TableRow key={project.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2.5 min-w-[12rem]">
                            <ProjectMilestoneLink
                              projectId={project.id}
                              hasStageLoss={project.has_stage_loss}
                            />
                            <Link
                              href={`/projects/${project.id}`}
                              className="truncate text-foreground hover:text-primary hover:underline underline-offset-4"
                            >
                              {project.name || `Project ${index + 1}`}
                            </Link>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatINR(project.contract_value)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatINR(project.total_expenses)}
                        </TableCell>
                        <TableCell className="text-right text-green-500">
                          {formatINR(project.total_received)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {project.progress}%
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            project.realized_profit >= 0 ? "text-green-500" : "text-destructive",
                          )}
                        >
                          {project.realized_profit >= 0 ? "+" : ""}
                          {formatINR(project.realized_profit)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-semibold",
                            project.forecast_profit >= 0 ? "text-green-500" : "text-destructive",
                          )}
                        >
                          {project.forecast_profit >= 0 ? "+" : ""}
                          {formatINR(project.forecast_profit)}
                          <span className="block text-[10px] font-normal text-muted-foreground">
                            {project.forecast_margin_percent}% margin
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
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
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        {formatINR(
                          projects.reduce((sum, p) => sum + p.contract_value, 0),
                        )}
                      </TableCell>
                      <TableCell className="text-right text-destructive">
                        {formatINR(
                          projects.reduce((sum, p) => sum + p.total_expenses, 0),
                        )}
                      </TableCell>
                      <TableCell className="text-right text-green-500">
                        {formatINR(
                          projects.reduce((sum, p) => sum + p.total_received, 0),
                        )}
                      </TableCell>
                      <TableCell />
                      <TableCell
                        className={cn(
                          "text-right",
                          projects.reduce((sum, p) => sum + p.realized_profit, 0) >= 0
                            ? "text-green-500"
                            : "text-destructive",
                        )}
                      >
                        {(() => {
                          const total = projects.reduce((sum, p) => sum + p.realized_profit, 0)
                          return `${total >= 0 ? "+" : ""}${formatINR(total)}`
                        })()}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right",
                          projects.reduce((sum, p) => sum + p.forecast_profit, 0) >= 0
                            ? "text-green-500"
                            : "text-destructive",
                        )}
                      >
                        {(() => {
                          const total = projects.reduce((sum, p) => sum + p.forecast_profit, 0)
                          return `${total >= 0 ? "+" : ""}${formatINR(total)}`
                        })()}
                      </TableCell>
                      <TableCell colSpan={2} />
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
          <div className={STATS_GRID_CLASS}>
            {isLoading || !displayCompany ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card className="card-metric bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Projects
                    </CardTitle>
                    <Briefcase className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums tracking-tight">{displayCompany.totalProjects}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        {displayCompany.activeProjects} Active
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {displayCompany.completedProjects} Completed
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-metric bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Contract Value
                    </CardTitle>
                    <Building2 className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums tracking-tight">
                      {formatINR(displayCompany.totalContractValue)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Across {scopeLabel}
                    </p>
                  </CardContent>
                </Card>

                <Card
                  className={cn(
                    "border-2",
                    displayCompany.realizedProfit >= 0
                      ? "bg-green-500/5 border-green-500/30"
                      : "bg-destructive/5 border-destructive/30",
                  )}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Realized Profit
                    </CardTitle>
                    {displayCompany.realizedProfit >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-destructive" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div
                      className={cn(
                        "text-2xl font-semibold tabular-nums tracking-tight",
                        displayCompany.realizedProfit >= 0 ? "text-green-500" : "text-destructive",
                      )}
                    >
                      {displayCompany.realizedProfit >= 0 ? "+" : ""}
                      {formatINR(displayCompany.realizedProfit)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Collected − spent so far (cash position)
                    </p>
                  </CardContent>
                </Card>

                <Card className="card-metric bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Forecast Profit
                    </CardTitle>
                    {displayCompany.forecastProfit >= displayCompany.expectedProfit ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-yellow-500" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div
                      className={cn(
                        "text-2xl font-semibold tabular-nums tracking-tight",
                        displayCompany.forecastProfit >= 0 ? "text-green-500" : "text-destructive",
                      )}
                    >
                      {displayCompany.forecastProfit >= 0 ? "+" : ""}
                      {formatINR(displayCompany.forecastProfit)}
                    </div>
                    <div className="flex flex-col gap-0.5 mt-2 text-xs text-muted-foreground">
                      <span>
                        Forecast margin{" "}
                        <span className="font-medium text-foreground">
                          {displayCompany.forecastMarginPercent}%
                        </span>
                      </span>
                      <span>
                        Target at plan: {formatINR(displayCompany.expectedProfit)} (
                        {displayCompany.weightedMarginPercent}%)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">
            {showAllProjects ? "Company Cashflow" : "Project Cashflow"}
          </h2>
          <div className={STATS_GRID_3_CLASS}>
            {isLoading || !displayCompany ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card
                  className={cn(
                    "border-2",
                    displayCompany.currentCashflow >= 0
                      ? "bg-green-500/5 border-green-500/30"
                      : "bg-destructive/5 border-destructive/30"
                  )}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Current Cashflow
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div
                      className={cn(
                        "text-2xl font-semibold tabular-nums tracking-tight",
                        displayCompany.currentCashflow >= 0
                          ? "text-green-500"
                          : "text-destructive",
                      )}
                    >
                      {displayCompany.currentCashflow >= 0 ? "+" : ""}
                      {formatINR(displayCompany.currentCashflow)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Net cash position across {scopeLabel}
                    </p>
                  </CardContent>
                </Card>

                <Card className="card-metric bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending Receivables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums tracking-tight text-green-500">
                      {formatINR(displayCompany.totalReceivables)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Client payments due</p>
                  </CardContent>
                </Card>

                <Card className="card-metric bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending Payables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-semibold tabular-nums tracking-tight text-destructive">
                      {formatINR(displayCompany.totalPayables)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Vendor payments due</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4">Risk Alerts</h2>
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
                    displayCompany.overbudgetProjects > 0
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-card border-border",
                  )}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          displayCompany.overbudgetProjects > 0 ? "bg-destructive/20" : "bg-muted"
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            "h-6 w-6",
                            displayCompany.overbudgetProjects > 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            displayCompany.overbudgetProjects > 0 ? "text-destructive" : ""
                          )}
                        >
                          {displayCompany.overbudgetProjects}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {showAllProjects ? "Over Budget Projects" : "Over Budget"}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={
                    displayCompany.cashflowWarnings > 0
                      ? "bg-yellow-500/5 border-yellow-500/30"
                      : "bg-card border-border"
                  }
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          displayCompany.cashflowWarnings > 0 ? "bg-yellow-500/20" : "bg-muted"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-6 w-6",
                            displayCompany.cashflowWarnings > 0
                              ? "text-yellow-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            displayCompany.cashflowWarnings > 0 ? "text-yellow-500" : ""
                          )}
                        >
                          {displayCompany.cashflowWarnings}
                        </p>
                        <p className="text-sm text-muted-foreground">Cashflow Warnings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="card-metric bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {displayCompany.totalPMs} / {displayCompany.totalEngineers}
                        </p>
                        <p className="text-sm text-muted-foreground">PMs / Engineers</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
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
