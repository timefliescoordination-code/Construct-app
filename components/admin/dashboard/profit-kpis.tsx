"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { formatSignedINR } from "@/components/admin/dashboard/format"

export function ProfitKpis({
  expectedProfit,
  actualProfit,
  profitAtRisk,
  cashAvailable,
  isLoading,
}: {
  expectedProfit: number
  actualProfit: number
  profitAtRisk: number
  cashAvailable: number
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border">
            <CardContent className="p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-32" />
              <Skeleton className="mt-2 h-3 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: "Expected Profit",
      value: formatINR(expectedProfit),
      hint: "Based on contract value and planned margin",
      valueClass: "text-foreground",
    },
    {
      label: "Actual Profit",
      value: formatSignedINR(actualProfit),
      hint: "Based on completed project stages",
      valueClass: actualProfit >= 0 ? "text-success" : "text-destructive",
    },
    {
      label: "Profit at Risk",
      value: formatINR(profitAtRisk),
      hint: "Profit potentially lost from projects currently underperforming",
      valueClass: profitAtRisk > 0 ? "text-destructive" : "text-muted-foreground",
    },
    {
      label: "Cash Available",
      value: formatSignedINR(cashAvailable),
      hint: "Received minus approved spending",
      valueClass: cashAvailable >= 0 ? "text-foreground" : "text-destructive",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border-border shadow-sm">
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className={cn("mt-2 text-xl font-semibold tabular-nums tracking-tight", card.valueClass)}>
              {card.value}
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{card.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
