"use client"

import { format } from "date-fns"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR, formatINRCompact } from "@/lib/currency"
import { cn } from "@/lib/utils"
import type { MonthlyCashPoint, TrendRange } from "@/lib/dashboard-profit-view"

export function ProfitTrend({
  series,
  range,
  onRangeChange,
  isLoading,
}: {
  series: MonthlyCashPoint[]
  range: TrendRange
  onRangeChange: (range: TrendRange) => void
  isLoading?: boolean
}) {
  const chartData = series.map((point) => ({
    ...point,
    label: format(new Date(`${point.month}-01T00:00:00`), "MMM yy"),
  }))

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Profit Trend</CardTitle>
          <CardDescription>
            Cash generated (received − spent) by month — not completed-stage profit
          </CardDescription>
        </div>
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(
            [
              ["6m", "6 months"],
              ["12m", "12 months"],
              ["ytd", "This year"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={range === value ? "secondary" : "ghost"}
              className={cn("h-7 px-2.5 text-xs", range === value && "bg-muted")}
              onClick={() => onRangeChange(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-52 w-full" />
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatINRCompact(value)}
                  width={56}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const row = payload[0].payload as MonthlyCashPoint & { label: string }
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium">{row.label}</p>
                        <p className="mt-1 text-muted-foreground">Net {formatINR(row.net)}</p>
                      </div>
                    )
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
