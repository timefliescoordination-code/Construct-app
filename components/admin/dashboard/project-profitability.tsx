"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { HealthBadge } from "@/components/dashboard/financial-layers"
import { ScrollTable } from "@/components/layout/scroll-table"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatSignedINR } from "@/components/admin/dashboard/format"
import type { AdminProjectSummary } from "@/lib/admin-dashboard-data"
import { presentationHealth, projectStageMarginPercent } from "@/lib/dashboard-profit-view"

export function ProjectProfitability({
  projects,
  isLoading,
}: {
  projects: AdminProjectSummary[]
  isLoading?: boolean
}) {
  const router = useRouter()

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Project Profitability</CardTitle>
        <CardDescription>See which projects are making or losing money</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {isLoading ? (
          <div className="space-y-2 px-6 pb-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : projects.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-muted-foreground">No projects to show.</p>
        ) : (
          <>
            <div className="grid gap-3 px-4 pb-4 sm:hidden">
              {projects.map((project) => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  className="rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{project.name || "Unnamed project"}</p>
                    <HealthBadge health={project.health} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-muted-foreground">Progress</dt>
                      <dd className="tabular-nums">{Math.round(project.progress)}%</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Profit/Loss</dt>
                      <dd
                        className={cn(
                          "font-medium tabular-nums",
                          project.completed_stage_profit_loss >= 0
                            ? "text-success"
                            : "text-destructive",
                        )}
                      >
                        {formatSignedINR(project.completed_stage_profit_loss)}
                      </dd>
                    </div>
                  </dl>
                </button>
              ))}
            </div>
            <ScrollTable className="hidden px-4 pb-4 sm:block sm:px-0 sm:pb-0" minWidth="min-w-[40rem]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                    <TableHead className="text-right">Profit/Loss</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => {
                    const margin = projectStageMarginPercent(project)
                    const tone = presentationHealth(project)
                    return (
                      <TableRow
                        key={project.id}
                        className="cursor-pointer hover:bg-muted/40"
                        tabIndex={0}
                        onClick={() => router.push(`/projects/${project.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault()
                            router.push(`/projects/${project.id}`)
                          }
                        }}
                      >
                        <TableCell className="font-medium">
                          {project.name || "Unnamed project"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {Math.round(project.progress)}%
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium tabular-nums",
                            project.completed_stage_profit_loss >= 0
                              ? "text-success"
                              : "text-destructive",
                          )}
                        >
                          {formatSignedINR(project.completed_stage_profit_loss)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {margin == null ? "—" : `${margin.toFixed(1)}%`}
                        </TableCell>
                        <TableCell>
                          <HealthBadge health={project.health} />
                          {tone === "watch" && project.health === "on_track" ? (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-400">
                              Watch
                            </span>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollTable>
          </>
        )}
      </CardContent>
    </Card>
  )
}
