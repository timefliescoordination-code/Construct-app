"use client"

import { format } from "date-fns"
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { formatSignedINR } from "@/components/admin/dashboard/format"
import type { MonthlyCashPoint } from "@/lib/dashboard-profit-view"

export function ProfitHero({
  actualProfit,
  marginPercent,
  cashDeltaPercent,
  sparkline,
  isLoading,
}: {
  actualProfit: number
  marginPercent: number | null
  cashDeltaPercent: number | null
  sparkline: MonthlyCashPoint[]
  isLoading?: boolean
}) {
  const positive = actualProfit >= 0
  const chartData = sparkline.map((point) => ({
    ...point,
    label: format(new Date(`${point.month}-01T00:00:00`), "MMM"),
  }))

  if (isLoading) {
    return (
      <Card className="border-border shadow-sm">
        <CardContent className="p-6 sm:p-8">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-3 h-10 w-56" />
          <Skeleton className="mt-3 h-4 w-40" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden border-border shadow-sm">
      <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[1fr_minmax(220px,280px)] lg:items-center">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Portfolio Profit</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Profit generated across your active projects
          </p>
          <p
            className={cn(
              "mt-5 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl",
              positive ? "text-success" : "text-destructive",
            )}
          >
            {formatSignedINR(actualProfit)}
          </p>
          {marginPercent != null ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {marginPercent.toFixed(1)}% profit margin
              <span className="ml-1.5 text-xs">on completed stages</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Completed-stage profit. Margin appears after stages are completed.
            </p>
          )}
          {cashDeltaPercent != null ? (
            <p
              className={cn(
                "mt-3 text-xs",
                cashDeltaPercent > 0
                  ? "text-success"
                  : cashDeltaPercent < 0
                    ? "text-destructive"
                    : "text-muted-foreground",
              )}
            >
              {cashDeltaPercent > 0 ? "↑" : cashDeltaPercent < 0 ? "↓" : "→"}{" "}
              {Math.abs(cashDeltaPercent).toFixed(1)}% cash vs previous period
            </p>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              Cash vs previous period needs prior-period activity to compare.
            </p>
          )}
        </div>
        <div className="min-w-0">
          <div className="h-28 sm:h-32">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="label" hide />
                <Tooltip
                  cursor={{ stroke: "var(--border)" }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const row = payload[0].payload as MonthlyCashPoint & { label: string }
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium">{row.label}</p>
                        <p className="mt-1 text-muted-foreground">
                          Cash net {formatINR(row.net)}
                        </p>
                      </div>
                    )
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="net"
                  stroke="var(--primary)"
                  fill="var(--primary)"
                  fillOpacity={0.12}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No cash movement to chart yet
            </p>
          )}
          </div>
          <p className="mt-1 text-center text-[10px] text-muted-foreground">
            Liquidity over time — not stage profit
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
