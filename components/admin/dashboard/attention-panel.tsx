"use client"

import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HealthBadge } from "@/components/dashboard/financial-layers"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatSignedINR } from "@/components/admin/dashboard/format"
import type { AdminProjectSummary } from "@/lib/admin-dashboard-data"
import { presentationHealth } from "@/lib/dashboard-profit-view"

export function AttentionPanel({
  projects,
  isLoading,
}: {
  projects: AdminProjectSummary[]
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">What needs your attention?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">What needs your attention?</CardTitle>
        <p className="text-sm text-muted-foreground">Where you may be losing money right now</p>
      </CardHeader>
      <CardContent>
        {projects.length === 0 ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10 text-success">
              <Check className="h-4 w-4" />
            </div>
            <div>
              <p className="font-medium">Everything looks healthy</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No projects currently require immediate attention.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((project) => {
              const tone = presentationHealth(project)
              const isLoss = project.completed_stage_profit_loss < 0
              return (
                <li
                  key={project.id}
                  className={cn(
                    "flex flex-col gap-3 rounded-xl border border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                    tone === "at_risk" && "border-destructive/20 bg-destructive/[0.03]",
                    tone === "watch" && "border-amber-500/20 bg-amber-500/[0.04]",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-foreground">
                        {project.name || "Unnamed project"}
                      </p>
                      <HealthBadge health={project.health} />
                    </div>
                    <p
                      className={cn(
                        "mt-1 text-sm font-medium tabular-nums",
                        isLoss ? "text-destructive" : "text-amber-700 dark:text-amber-400",
                      )}
                    >
                      {isLoss
                        ? `${formatSignedINR(project.completed_stage_profit_loss)} loss`
                        : `${formatSignedINR(project.completed_stage_profit_loss)} stage profit`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {isLoss
                        ? `${project.budget_usage_percent}% of stage budget spent`
                        : "Low profitability despite active spending"}
                    </p>
                  </div>
                  <Link
                    href={`/projects/${project.id}`}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                  >
                    Review Project
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
