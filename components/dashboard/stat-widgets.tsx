"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  variant = "default" 
}: StatWidgetProps) {
  const variantStyles = {
    default: "bg-card border-border",
    warning: "bg-card border-warning/30",
    danger: "bg-card border-destructive/30",
    success: "bg-card border-success/30"
  }

  const iconStyles = {
    default: "text-primary",
    warning: "text-warning",
    danger: "text-destructive",
    success: "text-success"
  }

  return (
    <Card className={`${variantStyles[variant]} transition-all hover:border-primary/50`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconStyles[variant]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-muted-foreground">{description}</p>
          {trend && (
            <span className={`text-xs font-medium ${trend.positive ? 'text-success' : 'text-destructive'}`}>
              {trend.positive ? '+' : ''}{trend.value}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// PM-specific widgets - fetches data from Supabase
export function DashboardWidgets() {
  const { project, isLoading, error } = useDefaultProject()
  const metrics = useProjectMetrics(project)

  if (isLoading) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="bg-card border-border">
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
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {widgets.map((widget, index) => (
        <StatWidget key={index} {...widget} />
      ))}
    </div>
  )
}
