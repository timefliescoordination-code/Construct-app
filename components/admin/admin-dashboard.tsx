"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
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
import { useAdminDashboard } from "@/lib/hooks/use-admin-dashboard"
import { PM_NOT_CREATED } from "@/lib/staff-labels"
import { DashboardHeader } from "@/components/dashboard/header"
import { useAuth } from "@/lib/hooks/use-auth"

function StatCardSkeleton() {
  return (
    <Card className="bg-card border-border">
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
    <Card className={cn("bg-card border-border", className)}>
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
    <Card className="bg-muted/30">
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

export function AdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState("30d")
  const { projects, company, projectManagers, isLoading, error } = useAdminDashboard()
  const { isAdmin, canManageProjects, isLoading: authLoading } = useAuth()
  const showCreateProject = !authLoading && (isAdmin || canManageProjects)

  const cashflowWarnings = company?.cashflowWarnings ?? 0

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader notificationCount={cashflowWarnings} />

      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Company-wide financial overview and project management
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[140px] bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="border-border" asChild>
              <Link href="/projects">View Projects</Link>
            </Button>

            {showCreateProject && (
              <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
                <Link href="/projects/new">
                  <Plus className="h-4 w-4" />
                  New Project
                </Link>
              </Button>
            )}

            <Button variant="outline" className="border-border">
              <Calendar className="mr-2 h-4 w-4" />
              Export Report
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error.message}
          </div>
        )}

        <section className="mb-8">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {isLoading || !company ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Projects
                    </CardTitle>
                    <Briefcase className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{company.totalProjects}</div>
                    <div className="flex items-center gap-2 mt-2 text-xs">
                      <Badge variant="outline" className="text-green-500 border-green-500/30">
                        {company.activeProjects} Active
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        {company.completedProjects} Completed
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Contract Value
                    </CardTitle>
                    <Building2 className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {formatINR(company.totalContractValue)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Across all {company.totalProjects} projects
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Expected Profit
                    </CardTitle>
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-500">
                      {formatINR(company.expectedProfit)}
                    </div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                      <ArrowUpRight className="h-3 w-3" />
                      {company.weightedMarginPercent}% margin
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Projected Profit
                    </CardTitle>
                    {company.projectedProfit >= company.expectedProfit ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-yellow-500" />
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{formatINR(company.projectedProfit)}</div>
                    <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                      {company.projectedProfit >= company.expectedProfit ? (
                        <>
                          <ArrowUpRight className="h-3 w-3 text-green-500" />
                          <span className="text-green-500">On track</span>
                        </>
                      ) : (
                        <>
                          <ArrowDownRight className="h-3 w-3 text-yellow-500" />
                          <span className="text-yellow-500">Below expected</span>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Company Cashflow</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {isLoading || !company ? (
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
                    company.currentCashflow >= 0
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
                        "text-3xl font-bold",
                        company.currentCashflow >= 0 ? "text-green-500" : "text-destructive"
                      )}
                    >
                      {company.currentCashflow >= 0 ? "+" : ""}
                      {formatINR(company.currentCashflow)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      Net cash position across all projects
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending Receivables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-green-500">
                      {formatINR(company.totalReceivables)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Client payments due</p>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Pending Payables
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-destructive">
                      {formatINR(company.totalPayables)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Vendor payments due</p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4">Risk Alerts</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {isLoading || !company ? (
              <>
                <MetricSkeleton />
                <MetricSkeleton />
                <MetricSkeleton />
              </>
            ) : (
              <>
                <Card
                  className={
                    company.overbudgetProjects > 0
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-card border-border"
                  }
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          company.overbudgetProjects > 0 ? "bg-destructive/20" : "bg-muted"
                        )}
                      >
                        <AlertCircle
                          className={cn(
                            "h-6 w-6",
                            company.overbudgetProjects > 0
                              ? "text-destructive"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            company.overbudgetProjects > 0 ? "text-destructive" : ""
                          )}
                        >
                          {company.overbudgetProjects}
                        </p>
                        <p className="text-sm text-muted-foreground">Over Budget Projects</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card
                  className={
                    company.cashflowWarnings > 0
                      ? "bg-yellow-500/5 border-yellow-500/30"
                      : "bg-card border-border"
                  }
                >
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "p-3 rounded-lg",
                          company.cashflowWarnings > 0 ? "bg-yellow-500/20" : "bg-muted"
                        )}
                      >
                        <AlertTriangle
                          className={cn(
                            "h-6 w-6",
                            company.cashflowWarnings > 0
                              ? "text-yellow-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </div>
                      <div>
                        <p
                          className={cn(
                            "text-2xl font-bold",
                            company.cashflowWarnings > 0 ? "text-yellow-500" : ""
                          )}
                        >
                          {company.cashflowWarnings}
                        </p>
                        <p className="text-sm text-muted-foreground">Cashflow Warnings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card border-border">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <Users className="h-6 w-6 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">
                          {company.totalPMs} / {company.totalEngineers}
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {projectManagers.map((pm) => {
                    const pmName = pm.full_name || pm.email
                    const assignedProjects = projects.filter((project) => project.pm_label === pmName)
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
      </main>
    </div>
  )
}
