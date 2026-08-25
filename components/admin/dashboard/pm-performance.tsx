"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { formatSignedINR } from "@/components/admin/dashboard/format"
import { PM_NOT_CREATED } from "@/lib/staff-labels"
import type { AdminProjectSummary } from "@/lib/admin-dashboard-data"
import type { Profile } from "@/lib/types/database"
import { STATS_GRID_CLASS } from "@/components/layout/page"

export function PmPerformance({
  projectManagers,
  projects,
  isLoading,
}: {
  projectManagers: Pick<Profile, "id" | "email" | "full_name" | "role">[]
  projects: AdminProjectSummary[]
  isLoading?: boolean
}) {
  const cards = projectManagers.filter((pm) => {
    const pmName = pm.full_name || pm.email
    return projects.some((project) => project.pm_label === pmName)
  })

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Project Manager Performance</CardTitle>
        <CardDescription>Workload connected to completed-stage profit</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className={STATS_GRID_CLASS}>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ) : cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm font-medium text-muted-foreground">{PM_NOT_CREATED}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Add project managers in User Management to assign them to projects.
            </p>
          </div>
        ) : (
          <div className={STATS_GRID_CLASS}>
            {cards.map((pm) => {
              const pmName = pm.full_name || pm.email
              const assigned = projects.filter((project) => project.pm_label === pmName)
              const avgCompletion = assigned.length
                ? Math.round(
                    assigned.reduce((sum, project) => sum + project.progress, 0) /
                      assigned.length,
                  )
                : 0
              const profit = assigned.reduce(
                (sum, project) => sum + project.completed_stage_profit_loss,
                0,
              )
              return (
                <div key={pm.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-primary/10 text-xs text-primary">
                        {pmName.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{pmName}</p>
                      <p className="text-xs text-muted-foreground">
                        {assigned.length} project{assigned.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Assigned Value</span>
                      <span className="tabular-nums">
                        {formatINR(
                          assigned.reduce((sum, project) => sum + project.contract_value, 0),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Average Completion</span>
                      <span className="tabular-nums">{avgCompletion}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Profit performance</span>
                      <span
                        className={cn(
                          "font-medium tabular-nums",
                          profit >= 0 ? "text-success" : "text-destructive",
                        )}
                      >
                        {formatSignedINR(profit)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
