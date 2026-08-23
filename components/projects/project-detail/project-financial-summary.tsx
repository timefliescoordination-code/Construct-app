"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { TimelineHintLines } from "@/components/dashboard/financial-layers"
import { summarizeChangeRequestFinancials } from "@/lib/change-requests/calculations"
import { formatINR } from "@/lib/currency"
import {
  getApprovedAdditionalWorksTotal,
  summarizeProjectFinancials,
} from "@/lib/financial-calculations"
import {
  buildReceivedTimelineLines,
  buildRemainingBudgetTimelineLines,
  buildSpentTimelineLines,
  projectTimelineFromProject,
} from "@/lib/project-timeline"
import type { ProjectWithDetails } from "@/lib/types/database"
import { cn } from "@/lib/utils"

interface ProjectFinancialSummaryProps {
  project: ProjectWithDetails
  className?: string
}

export function ProjectFinancialSummary({
  project,
  className,
}: ProjectFinancialSummaryProps) {
  const [changeSummary, setChangeSummary] = useState<ReturnType<
    typeof summarizeChangeRequestFinancials
  > | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/projects/${project.id}/change-requests`)
      .then((res) => res.json())
      .then((body) => {
        if (cancelled) return
        setChangeSummary(summarizeChangeRequestFinancials(body.requests ?? []))
      })
      .catch(() => {
        if (!cancelled) setChangeSummary(null)
      })
    return () => {
      cancelled = true
    }
  }, [project.id])

  const finances = useMemo(() => {
    const totalExpenses = project.expenses
      .filter((e) => e.status === "approved")
      .reduce((sum, e) => sum + Number(e.amount), 0)
    const additionalWorksApproved = getApprovedAdditionalWorksTotal(
      project.additional_works,
      project.additional_works_value,
    )

    return summarizeProjectFinancials({
      contractValue: Number(project.contract_value),
      additionalWorksApproved,
      expectedMarginPercent: Number(project.expected_margin_percent),
      totalExpenses,
    })
  }, [project])

  const timeline = useMemo(() => projectTimelineFromProject(project), [project])
  const spentTimelineLines = useMemo(
    () => buildSpentTimelineLines(timeline),
    [timeline],
  )
  const receivedTimelineLines = useMemo(() => {
    const received = project.client_payments
      .filter((p) => p.status === "received")
      .reduce((sum, p) => sum + Number(p.amount), 0)
    if (received <= 0) return []
    return buildReceivedTimelineLines(timeline)
  }, [project.client_payments, timeline])
  const remainingTimelineLines = useMemo(
    () => buildRemainingBudgetTimelineLines(timeline),
    [timeline],
  )

  const totalExpenses = finances.totalExpenses
  const totalReceived = project.client_payments
    .filter((p) => p.status === "received")
    .reduce((sum, p) => sum + Number(p.amount), 0)
  const originalContract = finances.originalContractValue

  return (
    <Card className={cn("section-card border-border", className)}>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs text-muted-foreground">Original contract</p>
          <p className="text-lg font-bold tabular-nums">{formatINR(originalContract)}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Base agreement before change orders
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Approved additional works</p>
          <p className="text-lg font-bold tabular-nums">
            {formatINR(finances.additionalWorksApproved)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Customer-accepted change orders
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Revised contract total</p>
          <p className="text-lg font-bold tabular-nums">
            {formatINR(finances.totalContractValue)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Original + approved additional works
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Stage Budget</p>
          <p className="text-lg font-bold tabular-nums text-primary">
            {formatINR(finances.stageBudget)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Contract value − expected profit
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Spent (approved)</p>
          <p className="text-lg font-bold tabular-nums text-destructive">
            {formatINR(totalExpenses)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {finances.stageBudgetUsagePercent}% of stage budget
          </p>
          <TimelineHintLines lines={spentTimelineLines} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Remaining stage budget</p>
          <p
            className={cn(
              "text-lg font-bold tabular-nums",
              finances.remainingStageBudget >= 0
                ? "text-green-500"
                : "text-destructive",
            )}
          >
            {formatINR(finances.remainingStageBudget)}
          </p>
          <TimelineHintLines lines={remainingTimelineLines} />
        </div>
        {changeSummary ? (
          <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2 grid gap-2 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Pending change estimates</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatINR(changeSummary.pendingValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Approved change-order value</p>
              <p className="text-sm font-semibold tabular-nums">
                {formatINR(changeSummary.approvedChangeValue)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Schedule impact (days)</p>
              <p className="text-sm font-semibold tabular-nums">
                +{changeSummary.pendingScheduleDays + changeSummary.approvedScheduleDays} est.
              </p>
            </div>
          </div>
        ) : null}
        {totalReceived > 0 ? (
          <div className="sm:col-span-2 lg:col-span-4 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-xs text-muted-foreground">Client payments received</p>
            <p className="text-sm font-semibold tabular-nums text-success">
              {formatINR(totalReceived)}
            </p>
            <TimelineHintLines lines={receivedTimelineLines} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
