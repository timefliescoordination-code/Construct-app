"use client"

import { formatINR } from "@/lib/currency"
import type { LabourTeamExpenseSummary } from "@/lib/data/labour-teams"
import { cn } from "@/lib/utils"

const TEAM_COLORS = [
  "border-l-sky-500/80 bg-sky-500/5",
  "border-l-amber-500/80 bg-amber-500/5",
  "border-l-violet-500/80 bg-violet-500/5",
  "border-l-emerald-500/80 bg-emerald-500/5",
  "border-l-rose-500/80 bg-rose-500/5",
  "border-l-cyan-500/80 bg-cyan-500/5",
  "border-l-orange-500/80 bg-orange-500/5",
  "border-l-indigo-500/80 bg-indigo-500/5",
]

interface LabourTeamExpenseStripProps {
  summaries: LabourTeamExpenseSummary[]
  totalApprovedLabour: number
  className?: string
}

export function LabourTeamExpenseStrip({
  summaries,
  totalApprovedLabour,
  className,
}: LabourTeamExpenseStripProps) {
  if (summaries.length === 0) return null

  return (
    <section
      className={cn(
        "rounded-lg border border-border bg-muted/20 px-3 py-2",
        className,
      )}
      aria-label="Labour payments by team"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Labour payments by team
        </p>
        <p className="text-[10px] text-muted-foreground">
          Approved total{" "}
          <span className="font-semibold text-foreground">
            {formatINR(totalApprovedLabour)}
          </span>
        </p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
        {summaries.map((team, index) => (
          <div
            key={team.teamId}
            className={cn(
              "min-w-[7.5rem] shrink-0 rounded-md border border-border border-l-[3px] px-2.5 py-1.5",
              TEAM_COLORS[index % TEAM_COLORS.length],
            )}
          >
            <p className="truncate text-[11px] font-medium leading-tight text-foreground">
              {team.teamName}
            </p>
            <p className="mt-0.5 text-sm font-bold leading-none text-primary">
              {formatINR(team.approvedTotal)}
            </p>
            {team.pendingTotal > 0 && (
              <p className="mt-0.5 text-[9px] text-muted-foreground">
                +{formatINR(team.pendingTotal)} pending
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
