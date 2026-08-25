"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

function HealthMetric({
  label,
  value,
  suffix = "projects",
}: {
  label: string
  value: number
  suffix?: string
}) {
  const quiet = value === 0
  return (
    <div
      className={cn(
        "rounded-xl border px-4 py-3",
        quiet ? "border-transparent bg-muted/30" : "border-border bg-card",
      )}
    >
      <p className={cn("text-xs", quiet ? "text-muted-foreground/80" : "text-muted-foreground")}>
        {label}
      </p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums",
          quiet ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
          {value === 1 && suffix === "projects" ? "project" : suffix}
        </span>
      </p>
    </div>
  )
}

export function BusinessHealth({
  cashRisk,
  collectionRisk,
  overdueBills,
  siteDelays,
  isLoading,
}: {
  cashRisk: number
  collectionRisk: number
  overdueBills: number
  siteDelays: number
  isLoading?: boolean
}) {
  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Business Health</CardTitle>
        <p className="text-sm text-muted-foreground">Only the signals that need a look</p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <HealthMetric label="Cash Risk" value={cashRisk} />
            <HealthMetric label="Collection Risk" value={collectionRisk} />
            <HealthMetric label="Overdue Bills" value={overdueBills} suffix={overdueBills === 1 ? "bill" : "bills"} />
            <HealthMetric label="Site Delays" value={siteDelays} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
