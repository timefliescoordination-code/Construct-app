"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type {
  PublicExpenseSheetRow,
  PublicSpendShare,
  PublicSubcategoryGroup,
  SpendCategory,
} from "@/lib/marketing/types"
import { cn } from "@/lib/utils"

const CATEGORY_CARD_CLASS: Record<SpendCategory, string> = {
  Materials: "bg-[#FDF2B3] text-stone-900",
  Labour: "bg-[#D1E9FF] text-sky-950",
  Equipment: "bg-[#E2D5F9] text-violet-950",
  Miscellaneous: "bg-[#C4F2C4] text-emerald-950",
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
        }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Public expense sheet</CardTitle>
        <CardDescription>
          Rounded shares only. Exact rupees, vendors, and invoices stay out of this preview and the
          copied markdown.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {spendMix.map((row) => (
            <div
              key={row.category}
              className={cn("rounded-2xl px-4 py-5 shadow-sm", CATEGORY_CARD_CLASS[row.category])}
            >
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{row.percent}%</p>
              <p className="mt-1 text-sm font-medium">{row.category}</p>
            </div>
          ))}
        </div>

        {subcategories.length > 0 ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">Subcategories recorded</p>
            <div className="space-y-3">
              {subcategories.map((group) => (
                <div key={group.category} className="space-y-1.5">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {group.category}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.names.map((name) => (
                      <Badge
                        key={`${group.category}-${name}`}
                        variant="secondary"
                        className="rounded-full"
                      >
                        {name}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-md border border-border bg-background">
          <table className="w-full min-w-[28rem] border-collapse text-sm">
            <thead>
              <tr className="bg-muted/70">
                <th className="border-b border-r border-border px-3 py-2 text-left font-semibold">
                  Category
                </th>
                <th className="border-b border-r border-border px-3 py-2 text-left font-semibold">
                  Subcategory
                </th>
                <th className="border-b border-border px-3 py-2 text-right font-semibold">
                  Approximate share
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.map((row, index) => (
                <tr key={`${row.category}-${row.subcategory ?? ""}-${index}`}>
                  <td className="border-b border-r border-border px-3 py-2">{row.category}</td>
                  <td className="border-b border-r border-border px-3 py-2 text-muted-foreground">
                    {row.subcategory ?? ""}
                  </td>
                  <td className="border-b border-border px-3 py-2 text-right font-medium tabular-nums">
                    {row.percent}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
