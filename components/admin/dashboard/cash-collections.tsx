"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { formatINR } from "@/lib/currency"
import { cn } from "@/lib/utils"
import { formatSignedINR } from "@/components/admin/dashboard/format"
import { formatLastPaymentLabel } from "@/lib/dashboard-profit-view"

export function CashCollections({
  cashAvailable,
  received,
  spent,
  balanceToCollect,
  collectedPercent,
  lastPaymentDate,
  isLoading,
}: {
  cashAvailable: number
  received: number
  spent: number
  balanceToCollect: number
  collectedPercent: number
  lastPaymentDate: string | null
  isLoading?: boolean
}) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Cash Position</CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums tracking-tight",
              cashAvailable >= 0 ? "text-foreground" : "text-destructive",
            )}
          >
            {formatSignedINR(cashAvailable)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Received minus approved spending</p>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Received</dt>
              <dd className="mt-0.5 tabular-nums">{formatINR(received)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Spent</dt>
              <dd className="mt-0.5 tabular-nums">{formatINR(spent)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Collections</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">
            {formatINR(balanceToCollect)}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Balance to collect</p>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{collectedPercent.toFixed(1)}% collected</span>
            </div>
            <Progress value={Math.min(100, Math.max(0, collectedPercent))} />
            <p className="text-xs text-muted-foreground">
              {formatLastPaymentLabel(lastPaymentDate)}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
