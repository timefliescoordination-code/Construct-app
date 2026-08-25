"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { aggregateAdminCompanyMetrics } from "@/lib/admin-dashboard-data"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAdminDashboard } from "@/lib/hooks/use-admin-dashboard"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import { MoneyTimelineSection } from "@/components/admin/money-timeline"
import { useAuth } from "@/lib/hooks/use-auth"
import { ProfitHero } from "@/components/admin/dashboard/profit-hero"
import { ProfitKpis } from "@/components/admin/dashboard/profit-kpis"
import { AttentionPanel } from "@/components/admin/dashboard/attention-panel"
import { ProjectProfitability } from "@/components/admin/dashboard/project-profitability"
import { ProfitSpendingChart } from "@/components/admin/dashboard/profit-spending-chart"
import { ProfitTrend } from "@/components/admin/dashboard/profit-trend"
import { QuickActions } from "@/components/admin/dashboard/quick-actions"
import { CashCollections } from "@/components/admin/dashboard/cash-collections"
import { BusinessHealth } from "@/components/admin/dashboard/business-health"
import { PmPerformance } from "@/components/admin/dashboard/pm-performance"
import {
  actualStageMarginPercent,
  cashVsPriorPeriodPercent,
  filterMonthlySeries,
  getAttentionProjects,
  type DashboardPeriod,
  type TrendRange,
} from "@/lib/dashboard-profit-view"

const SHOW_ALL_PROJECTS = "all"

export function AdminDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>("30d")
  const [trendRange, setTrendRange] = useState<TrendRange>("6m")
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

  const attentionProjects = useMemo(
    () => getAttentionProjects(visibleProjects),
    [visibleProjects],
  )

  const sparkline = useMemo(
    () => filterMonthlySeries(displayCompany?.monthlyCashSeries ?? [], "6m"),
    [displayCompany],
  )

  const trendSeries = useMemo(
    () => filterMonthlySeries(displayCompany?.monthlyCashSeries ?? [], trendRange),
    [displayCompany, trendRange],
  )

  const cashDeltaPercent = useMemo(() => {
    if (!displayCompany) return null
    return cashVsPriorPeriodPercent(displayCompany.cashByDate, selectedPeriod)
  }, [displayCompany, selectedPeriod])

  const actualMargin = displayCompany
    ? actualStageMarginPercent(
        displayCompany.totalCompletedStageProfitLoss,
        displayCompany.totalCompletedStageTarget,
      )
    : null

  const cashflowWarnings = displayCompany?.cashflowWarnings ?? 0

  return (
    <PageShell>
      <DashboardHeader notificationCount={cashflowWarnings} />

      <PageMain>
        <PageHeader
          title="Dashboard"
          description="Your construction profit at a glance"
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

          <Select
            value={selectedPeriod}
            onValueChange={(value) => setSelectedPeriod(value as DashboardPeriod)}
          >
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

          {isAdmin ? (
            <Button variant="outline" className="border-border w-full sm:w-auto" asChild>
              <Link href="/admin/expenses">View all expenses</Link>
            </Button>
          ) : null}
        </PageHeader>

        {error && (
          <div className="mb-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error.message}
          </div>
        )}

        <ProfitHero
          actualProfit={displayCompany?.totalCompletedStageProfitLoss ?? 0}
          marginPercent={actualMargin}
          cashDeltaPercent={cashDeltaPercent}
          sparkline={sparkline}
          isLoading={isLoading || !displayCompany}
        />

        <ProfitKpis
          expectedProfit={displayCompany?.totalPlannedProfit ?? 0}
          actualProfit={displayCompany?.totalCompletedStageProfitLoss ?? 0}
          profitAtRisk={displayCompany?.profitAtRisk ?? 0}
          cashAvailable={displayCompany?.portfolioCashBalance ?? 0}
          isLoading={isLoading || !displayCompany}
        />

        <AttentionPanel projects={attentionProjects} isLoading={isLoading} />

        <ProjectProfitability
          projects={visibleProjects}
          isLoading={isLoading}
        />

        <ProfitSpendingChart
          plannedBudget={displayCompany?.totalStageBudget ?? 0}
          actualSpending={displayCompany?.totalSpent ?? 0}
          expectedProfit={displayCompany?.totalPlannedProfit ?? 0}
          actualProfit={displayCompany?.totalCompletedStageProfitLoss ?? 0}
          isLoading={isLoading || !displayCompany}
        />

        <ProfitTrend
          series={trendSeries}
          range={trendRange}
          onRangeChange={setTrendRange}
          isLoading={isLoading || !displayCompany}
        />

        <QuickActions
          projects={projectPickerOptions}
          showCreateProject={showCreateProject}
          isAdmin={Boolean(isAdmin && !authLoading)}
        />

        <CashCollections
          cashAvailable={displayCompany?.portfolioCashBalance ?? 0}
          received={displayCompany?.totalReceived ?? 0}
          spent={displayCompany?.totalSpent ?? 0}
          balanceToCollect={displayCompany?.totalBalanceToCollect ?? 0}
          collectedPercent={displayCompany?.portfolioReceivedPercent ?? 0}
          lastPaymentDate={displayCompany?.lastClientPaymentDate ?? null}
          isLoading={isLoading || !displayCompany}
        />

        <BusinessHealth
          cashRisk={displayCompany?.cashRiskProjects ?? 0}
          collectionRisk={displayCompany?.collectionRiskProjects ?? 0}
          overdueBills={displayCompany?.cashflowWarnings ?? 0}
          siteDelays={displayCompany?.siteDelayProjects ?? 0}
          isLoading={isLoading || !displayCompany}
        />

        <PmPerformance
          projectManagers={projectManagers}
          projects={visibleProjects}
          isLoading={isLoading}
        />

        <MoneyTimelineSection />
      </PageMain>
    </PageShell>
  )
}
