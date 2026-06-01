"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PROJECT_HEALTH_LABELS,
  type ProjectHealthStatus,
} from "@/lib/dashboard-financials"

export type FinancialLayer = "plan" | "stage" | "cash"

const LAYER_STYLES: Record<
  FinancialLayer,
  { badge: string; accent: string; label: string }
> = {
  plan: {
    label: "Plan",
    badge: "bg-primary/10 text-primary border-primary/25",
    accent: "border-l-primary",
  },
  stage: {
    label: "Stage result",
    badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/25",
    accent: "border-l-violet-500",
  },
  cash: {
    label: "Cash",
    badge: "bg-success/10 text-success border-success/25",
    accent: "border-l-emerald-500",
  },
}

export function LayerBadge({ layer }: { layer: FinancialLayer }) {
  const style = LAYER_STYLES[layer]
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase", style.badge)}>
      {style.label}
    </Badge>
  )
}

export function DashboardSection({
  layer,
  title,
  description,
  children,
  className,
}: {
  layer: FinancialLayer
  title: string
  description?: string
  children: ReactNode
  className?: string
}) {
  const style = LAYER_STYLES[layer]
  return (
    <Card className={cn("dashboard-card overflow-hidden border-border", className)}>
      <div className={cn("border-l-4", style.accent)}>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-base font-semibold">{title}</CardTitle>
            <LayerBadge layer={layer} />
          </div>
          {description ? (
            <CardDescription className="text-sm">{description}</CardDescription>
          ) : null}
        </CardHeader>
        <CardContent className="pt-0">{children}</CardContent>
      </div>
    </Card>
  )
}

export function MetricTile({
  label,
  value,
  hint,
  valueClassName,
  className,
}: {
  label: string
  value: ReactNode
  hint?: string
  valueClassName?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-4 shadow-sm",
        className,
      )}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className={cn("mt-2 text-xl font-bold tabular-nums tracking-tight", valueClassName)}>
        {value}
      </div>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function HealthBadge({ health }: { health: ProjectHealthStatus }) {
  const styles: Record<ProjectHealthStatus, string> = {
    on_track: "bg-success/10 text-success border-success/30",
    cash_risk: "bg-destructive/10 text-destructive border-destructive/30",
    collection_risk: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
    stage_loss: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
    over_budget: "bg-destructive/10 text-destructive border-destructive/30",
  }
  return (
    <Badge variant="outline" className={cn("font-medium", styles[health])}>
      {PROJECT_HEALTH_LABELS[health]}
    </Badge>
  )
}
