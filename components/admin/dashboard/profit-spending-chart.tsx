"use client"

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR, formatINRCompact } from "@/lib/currency"

export function ProfitSpendingChart({
  plannedBudget,
  actualSpending,
  expectedProfit,
  actualProfit,
  isLoading,
}: {
  plannedBudget: number
  actualSpending: number
  expectedProfit: number
  actualProfit: number
  isLoading?: boolean
}) {
  const data = [
    { name: "Budget", value: plannedBudget, fill: "var(--muted-foreground)" },
    { name: "Spent", value: actualSpending, fill: "var(--primary)" },
    { name: "Expected", value: expectedProfit, fill: "var(--chart-1)" },
    {
      name: "Actual",
      value: actualProfit,
      fill: actualProfit >= 0 ? "var(--success)" : "var(--destructive)",
    },
  ]

  return (
    <Card className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Are we spending profitably?</CardTitle>
        <CardDescription>
          Planned construction budget vs spending, and expected vs completed-stage profit
          (Budget · Spent · Expected · Actual)
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-56 w-full" />
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                <XAxis
                  dataKey="name"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  interval={0}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                  tickFormatter={(value: number) => formatINRCompact(value)}
                  width={56}
                />
                <Tooltip
                  cursor={{ fill: "var(--muted)", fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null
                    const row = payload[0].payload as (typeof data)[number]
                    return (
                      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-sm">
                        <p className="font-medium">{row.name}</p>
                        <p className="mt-1 tabular-nums">{formatINR(row.value)}</p>
                      </div>
                    )
                  }}
                />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={56}>
                  {data.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
