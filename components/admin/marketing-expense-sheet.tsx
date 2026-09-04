"use client"

import {
  Boxes,
  HardHat,
  Truck,
  LayoutGrid,
  Receipt,
  type LucideIcon,
} from "lucide-react"
import { formatINR } from "@/lib/currency"
import type {
  PublicExpenseSheetRow,
  PublicSpendShare,
  PublicSubcategoryGroup,
} from "@/lib/marketing/types"
import { cn } from "@/lib/utils"

const CATEGORY_STYLE: Record<
  string,
  { icon: LucideIcon; accent: string; iconBg: string }
> = {
  Materials: {
    icon: Boxes,
    accent: "border-l-primary",
    iconBg: "bg-primary/10 text-primary",
  },
  Labour: {
    icon: HardHat,
    accent: "border-l-amber-500",
    iconBg: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  },
  Equipment: {
    icon: Truck,
    accent: "border-l-violet-500",
    iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  Miscellaneous: {
    icon: LayoutGrid,
    accent: "border-l-muted-foreground/50",
    iconBg: "bg-muted text-muted-foreground",
  },
}

const DEFAULT_STYLE = {
  icon: Receipt,
  accent: "border-l-border",
  iconBg: "bg-muted text-muted-foreground",
}

function styleForCategory(category: string) {
  return CATEGORY_STYLE[category] ?? DEFAULT_STYLE
}

export function MarketingExpenseSheet({
  spendMix,
  expenseSheet,
  subcategories,
}: {
  spendMix: PublicSpendShare[]
  expenseSheet: PublicExpenseSheetRow[]
  subcategories: PublicSubcategoryGroup[]
}) {
  if (!spendMix.length) return null

  const sheet =
    expenseSheet.length > 0
      ? expenseSheet
      : spendMix.map((row) => ({
          category: row.category,
          subcategory: null,
          percent: row.percent,
          amount: row.amount,
          count: row.count,
        }))

  const grandTotal = spendMix.reduce((sum, row) => sum + row.amount, 0)
  const grandCount = spendMix.reduce((sum, row) => sum + row.count, 0)

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Spending by category
          </h2>
          <p className="text-sm text-muted-foreground">
            Showing approved expenses only. Vendors, invoices, and client identity stay out of this
            draft.
          </p>
        </div>
        <div className="flex gap-6 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold tabular-nums text-foreground">{formatINR(grandTotal)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Entries</p>
            <p className="font-semibold tabular-nums text-foreground">{grandCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {spendMix.map((row) => {
          const { icon: Icon, accent, iconBg } = styleForCategory(row.category)
          return (
            <div
              key={row.category}
              className={cn(
                "relative flex flex-col rounded-xl border border-border bg-card p-4 text-left shadow-sm",
                "border-l-4",
                accent,
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    iconBg,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {row.count} {row.count === 1 ? "entry" : "entries"}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground">{row.category}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatINR(row.amount)}
              </p>
              <p className="mt-2 text-[11px] text-green-600 dark:text-green-500">
                {formatINR(row.amount)} approved
              </p>
            </div>
          )
        })}
      </div>

      {subcategories.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          Subcategories recorded:{" "}
          {subcategories
            .flatMap((group) => group.names)
            .join(", ")}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-md border border-border bg-background">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="bg-muted/70">
              <th className="border-b border-r border-border px-3 py-2 text-left font-semibold">
                Category
              </th>
              <th className="border-b border-r border-border px-3 py-2 text-left font-semibold">
                Subcategory / team
              </th>
              <th className="border-b border-r border-border px-3 py-2 text-right font-semibold">
                Amount
              </th>
              <th className="border-b border-border px-3 py-2 text-right font-semibold">
                Entries
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.map((row, index) => (
              <tr key={`${row.category}-${row.subcategory ?? ""}-${index}`}>
                <td className="border-b border-r border-border px-3 py-2">{row.category}</td>
                <td className="border-b border-r border-border px-3 py-2 text-muted-foreground">
                  {row.subcategory ?? "—"}
                </td>
                <td className="border-b border-r border-border px-3 py-2 text-right font-medium tabular-nums">
                  {formatINR(row.amount)}
                </td>
                <td className="border-b border-border px-3 py-2 text-right tabular-nums">
                  {row.count}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
