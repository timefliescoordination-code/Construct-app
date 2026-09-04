"use client"

import { useMemo } from "react"
import {
  Boxes,
  HardHat,
  Truck,
  LayoutGrid,
  Receipt,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatINRDetailed } from "@/lib/currency"
import {
  buildExpenseDetailRows,
  type ExpenseSpendingInput,
} from "@/lib/expense/spending-detail"

export type ExpenseCategoryStat = {
  category: string
  total: number
  approved: number
  pending: number
  rejected: number
  count: number
}

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

export function buildExpenseCategoryStats(
  expenses: ExpenseSpendingInput[],
  categoryNames: string[],
  options?: { statusFilter?: string },
): ExpenseCategoryStat[] {
  const statusFilter = options?.statusFilter ?? "all"
  const filtered = expenses.filter((e) => {
    if (statusFilter !== "all" && e.status !== statusFilter) return false
    return true
  })

  const byCategory = new Map<string, ExpenseCategoryStat>()

  for (const name of categoryNames) {
    byCategory.set(name, {
      category: name,
      total: 0,
      approved: 0,
      pending: 0,
      rejected: 0,
      count: 0,
    })
  }

  for (const exp of filtered) {
    const cat = exp.category?.trim() || "Uncategorized"
    let stat = byCategory.get(cat)
    if (!stat) {
      stat = {
        category: cat,
        total: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        count: 0,
      }
      byCategory.set(cat, stat)
    }

    const amount = Number(exp.amount)
    stat.total += amount
    stat.count += 1
    if (exp.status === "approved") stat.approved += amount
    else if (exp.status === "pending") stat.pending += amount
    else if (exp.status === "rejected") stat.rejected += amount
  }

  const ordered: ExpenseCategoryStat[] = []
  for (const name of categoryNames) {
    const stat = byCategory.get(name)
    if (stat) ordered.push(stat)
  }

  for (const [name, stat] of byCategory) {
    if (!categoryNames.includes(name)) ordered.push(stat)
  }

  return ordered
}

interface ExpenseCategorySummaryProps {
  expenses: ExpenseSpendingInput[]
  categoryNames: string[]
  statusFilter?: string
  activeCategory?: string
  onCategoryClick?: (category: string) => void
  className?: string
}

export function ExpenseCategorySummary({
  expenses,
  categoryNames,
  statusFilter = "all",
  activeCategory = "all",
  onCategoryClick,
  className,
}: ExpenseCategorySummaryProps) {
  const stats = useMemo(
    () => buildExpenseCategoryStats(expenses, categoryNames, { statusFilter }),
    [expenses, categoryNames, statusFilter],
  )

  const detailRows = useMemo(
    () =>
      buildExpenseDetailRows(expenses, categoryNames, {
        statusFilter,
        categoryFilter: activeCategory,
      }),
    [expenses, categoryNames, statusFilter, activeCategory],
  )

  const grandTotal = useMemo(
    () => stats.reduce((sum, s) => sum + s.total, 0),
    [stats],
  )
  const grandCount = useMemo(
    () => stats.reduce((sum, s) => sum + s.count, 0),
    [stats],
  )

  if (stats.length === 0) return null

  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Spending by category
          </h2>
          <p className="text-sm text-muted-foreground">
            {statusFilter === "all"
              ? "Totals across all approval statuses"
              : `Showing ${statusFilter} expenses only`}
          </p>
        </div>
        <div className="flex gap-6 rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm">
          <div>
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold tabular-nums text-foreground">
              {formatINRDetailed(grandTotal)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Entries</p>
            <p className="font-semibold tabular-nums text-foreground">{grandCount}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const { icon: Icon, accent, iconBg } = styleForCategory(stat.category)
          const isActive = activeCategory === stat.category
          const hasSpend = stat.count > 0

          return (
            <button
              key={stat.category}
              type="button"
              disabled={!onCategoryClick}
              onClick={() => onCategoryClick?.(stat.category)}
              className={cn(
                "group relative flex flex-col rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all",
                "border-l-4",
                accent,
                onCategoryClick &&
                  "cursor-pointer hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive && "ring-2 ring-primary/50 border-primary/40 bg-primary/5",
                !hasSpend && "opacity-75",
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
                {stat.count > 0 && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    {stat.count} {stat.count === 1 ? "entry" : "entries"}
                  </span>
                )}
              </div>

              <p className="mt-3 text-sm font-medium text-foreground">{stat.category}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-foreground">
                {formatINRDetailed(stat.total)}
              </p>

              {hasSpend ? (
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                  {stat.approved > 0 && (
                    <span className="text-green-600 dark:text-green-500">
                      {formatINRDetailed(stat.approved)} approved
                    </span>
                  )}
                  {stat.pending > 0 && (
                    <span className="text-amber-600 dark:text-amber-500">
                      {formatINRDetailed(stat.pending)} pending
                    </span>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-[11px] text-muted-foreground">No expenses yet</p>
              )}
            </button>
          )
        })}
      </div>

      {detailRows.length > 0 ? (
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
                <th className="border-b border-r border-border px-3 py-2 text-right font-semibold">
                  Approved
                </th>
                <th className="border-b border-border px-3 py-2 text-right font-semibold">
                  Entries
                </th>
              </tr>
            </thead>
            <tbody>
              {detailRows.map((row) => (
                <tr key={`${row.category}-${row.subcategory ?? ""}`}>
                  <td className="border-b border-r border-border px-3 py-2">{row.category}</td>
                  <td className="border-b border-r border-border px-3 py-2 text-muted-foreground">
                    {row.subcategory ?? "—"}
                  </td>
                  <td className="border-b border-r border-border px-3 py-2 text-right font-medium tabular-nums">
                    {formatINRDetailed(row.total)}
                  </td>
                  <td className="border-b border-r border-border px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatINRDetailed(row.approved)}
                  </td>
                  <td className="border-b border-border px-3 py-2 text-right tabular-nums">
                    {row.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {onCategoryClick && activeCategory !== "all" && (
        <p className="text-xs text-muted-foreground">
          Table filtered to <span className="font-medium text-foreground">{activeCategory}</span>
          .{" "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => onCategoryClick("all")}
          >
            Show all categories
          </button>
        </p>
      )}
    </section>
  )
}
