"use client"

import { Card, CardContent } from "@/components/ui/card"
import { MetricCard } from "@/components/layout/metric-card"
import { STATS_GRID_CLASS } from "@/components/layout/page"
import { 
  Briefcase, 
  Activity, 
  IndianRupee, 
  CreditCard,
  TrendingUp,
  Calculator,
  AlertTriangle,
  AlertCircle,
  Loader2,
  type LucideIcon
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import { useDefaultProject, useProjectMetrics } from "@/lib/hooks/use-project-data"

interface StatWidgetProps {
  title: string
  value: string
  description: string
  icon: LucideIcon
  trend?: {
    value: string
    positive: boolean
  }
  variant?: "default" | "warning" | "danger" | "success"
}

export function StatWidget({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
}: StatWidgetProps) {
  const descriptionNode = (
    <div className="flex flex-wrap items-center gap-2">
      <span>{description}</span>
      {trend && (
        <span
          className={`font-medium ${trend.positive ? "text-success" : "text-destructive"}`}
        >
          {trend.positive ? "+" : ""}
          {trend.value}
        </span>
      )}
    </div>
  )

  return (
    <MetricCard
      title={title}
      value={value}
      description={descriptionNode}
      icon={Icon}
      variant={variant}
      className="transition-colors hover:border-primary/40"
    />
  )
}

// PM-specific widgets - fetches data from Supabase
export function DashboardWidgets() {
  const { project, isLoading, error } = useDefaultProject()
  const metrics = useProjectMetrics(project)

  if (isLoading) {
    return (
      <div className={STATS_GRID_CLASS}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="card-metric bg-card border-border">
            <CardContent className="pt-6 flex items-center justify-center h-24">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Unable to load dashboard data
      </div>
    )
  }

  // Calculate metrics from real data
  const pendingExpenses = project.expenses
    .filter(e => e.status === 'pending')
    .length

  const overduePayments = project.vendor_payments
    .filter(vp => vp.status === 'overdue')
    .length

  const isAtRisk = metrics.completionPercent < 30 && project.status === 'active'

  const widgets: StatWidgetProps[] = [
    {
      title: "My Projects",
      value: "1",
      description: "Projects assigned to you",
      icon: Briefcase,
      trend: { value: project.name, positive: true }
    },
    {
      title: "Active Projects",
      value: project.status === "active" ? "1" : "0",
      description: "Currently in progress",
      icon: Activity,
      trend: { value: "On track", positive: true }
    },
    {
      title: "Pending Receivables",
      value: formatINR(metrics.totalClientPaymentsPending),
      description: "From your projects",
      icon: IndianRupee,
      variant: "success"
    },
    {
      title: "Pending Payables",
      value: formatINR(metrics.totalVendorPaymentsDue),
      description: "Vendor bills for your projects",
      icon: CreditCard,
      variant: metrics.totalVendorPaymentsDue > 0 ? "warning" : "default"
    },
    {
      title: "Projects on Track",
      value: project.status === "active" ? "1" : "0",
      description: "Meeting budget & timeline",
      icon: TrendingUp,
      variant: "success"
    },
    {
      title: "Avg. Completion",
      value: `${Math.round(metrics.completionPercent)}%`,
      description: "Across your projects",
      icon: Calculator,
      trend: { value: `${metrics.completionPercent > 50 ? '+' : ''}${Math.round(metrics.completionPercent - 50)}%`, positive: metrics.completionPercent >= 50 }
    },
    {
      title: "Attention Required",
      value: String(pendingExpenses),
      description: "Pending approvals & issues",
      icon: AlertTriangle,
      variant: pendingExpenses > 0 ? "warning" : "default"
    },
    {
      title: "At Risk",
      value: isAtRisk ? "1" : "0",
      description: overduePayments > 0 ? `${overduePayments} overdue payment(s)` : "Project needs attention",
      icon: AlertCircle,
      variant: isAtRisk || overduePayments > 0 ? "danger" : "default"
    }
  ]

  return (
    <div className={STATS_GRID_CLASS}>
      {widgets.map((widget, index) => (
        <StatWidget key={index} {...widget} />
      ))}
    </div>
  )
}
