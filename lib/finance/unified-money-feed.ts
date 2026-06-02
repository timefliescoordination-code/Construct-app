import type { SupabaseClient } from "@supabase/supabase-js"
import { isMissingFinanceTableError } from "@/lib/finance/finance-db"
import { normalizeDateValue, unwrapProject } from "@/lib/money-timeline/dates"

export type ExpenseLayer = "project" | "company" | "personal"

export type UnifiedMoneyRow = {
  id: string
  date: string
  direction: "in" | "out"
  layer: ExpenseLayer
  amount: number
  description: string
  category?: string
  projectId?: string
  projectName?: string
  linkHref?: string
}

export type LayerTotals = {
  expensesOut: number
  incomeIn: number
}

export type AllExpensesOverview = {
  project: LayerTotals
  company: LayerTotals
  personal: LayerTotals
}

export type AllExpensesFilters = {
  dateFrom?: string
  dateTo?: string
  layers: Set<ExpenseLayer>
}

function inDateRange(
  date: string,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (dateFrom && date < dateFrom) return false
  if (dateTo && date > dateTo) return false
  return true
}

function sumLayer(rows: UnifiedMoneyRow[], layer: ExpenseLayer): LayerTotals {
  const filtered = rows.filter((r) => r.layer === layer)
  return {
    expensesOut: filtered
      .filter((r) => r.direction === "out")
      .reduce((s, r) => s + r.amount, 0),
    incomeIn: filtered
      .filter((r) => r.direction === "in")
      .reduce((s, r) => s + r.amount, 0),
  }
}

export async function fetchUnifiedMoneyFeed(
  supabase: SupabaseClient,
  filters: AllExpensesFilters,
): Promise<{ rows: UnifiedMoneyRow[]; overview: AllExpensesOverview }> {
  const { dateFrom, dateTo, layers } = filters
  const rows: UnifiedMoneyRow[] = []

  const queries: Promise<void>[] = []

  if (layers.has("project")) {
    queries.push(
      (async () => {
        const [expensesResult, paymentsResult, projectsResult] =
          await Promise.all([
            supabase
              .from("expenses")
              .select(
                "id, project_id, description, category, amount, expense_date, projects(id, name)",
              )
              .eq("status", "approved"),
            supabase
              .from("client_payments")
              .select(
                "id, project_id, amount, received_date, created_at, stage_name, projects(id, name)",
              )
              .eq("status", "received"),
            supabase
              .from("projects")
              .select("id, name")
              .neq("status", "archived"),
          ])

        if (expensesResult.error) throw expensesResult.error
        if (paymentsResult.error) throw paymentsResult.error
        if (projectsResult.error) throw projectsResult.error

        const activeIds = new Set(
          (projectsResult.data ?? []).map((p) => p.id as string),
        )

        for (const row of expensesResult.data ?? []) {
          if (!activeIds.has(row.project_id as string)) continue
          const date = normalizeDateValue(row.expense_date)
          if (!date || !inDateRange(date, dateFrom, dateTo)) continue
          const project = unwrapProject(row.projects)
          const projectId = row.project_id as string
          rows.push({
            id: `project-expense-${row.id}`,
            date,
            direction: "out",
            layer: "project",
            amount: Number(row.amount),
            description:
              row.description?.trim() || (row.category as string) || "Expense",
            category: row.category as string,
            projectId,
            projectName: project?.name ?? "Unknown project",
            linkHref: `/projects/${projectId}?tab=expenses`,
          })
        }

        for (const row of paymentsResult.data ?? []) {
          if (!activeIds.has(row.project_id as string)) continue
          const date =
            normalizeDateValue(row.received_date) ??
            normalizeDateValue(row.created_at)
          if (!date || !inDateRange(date, dateFrom, dateTo)) continue
          const project = unwrapProject(row.projects)
          const projectId = row.project_id as string
          const stage = (row.stage_name as string)?.trim()
          rows.push({
            id: `project-income-${row.id}`,
            date,
            direction: "in",
            layer: "project",
            amount: Number(row.amount),
            description: stage
              ? `${project?.name ?? "Project"} — ${stage}`
              : `${project?.name ?? "Project"} payment received`,
            projectId,
            projectName: project?.name ?? "Unknown project",
            linkHref: `/projects/${projectId}?tab=payments`,
          })
        }
      })(),
    )
  }

  if (layers.has("company")) {
    queries.push(
      (async () => {
        const { data, error } = await supabase
          .from("company_expenses")
          .select("*")
          .order("expense_date", { ascending: false })

        if (error) {
          if (isMissingFinanceTableError(error)) return
          throw error
        }

        for (const row of data ?? []) {
          const date = normalizeDateValue(row.expense_date)
          if (!date || !inDateRange(date, dateFrom, dateTo)) continue
          rows.push({
            id: `company-expense-${row.id}`,
            date,
            direction: "out",
            layer: "company",
            amount: Number(row.amount),
            description: row.description as string,
            category: row.category as string,
            linkHref: "/admin/expenses?tab=company",
          })
        }

        const incomeResult = await supabase
          .from("company_income")
          .select("*")
          .order("received_date", { ascending: false })

        if (incomeResult.error) {
          if (isMissingFinanceTableError(incomeResult.error)) return
          throw incomeResult.error
        }

        for (const row of incomeResult.data ?? []) {
          const date = normalizeDateValue(row.received_date)
          if (!date || !inDateRange(date, dateFrom, dateTo)) continue
          const source = (row.source_name as string | null)?.trim()
          rows.push({
            id: `company-income-${row.id}`,
            date,
            direction: "in",
            layer: "company",
            amount: Number(row.amount),
            description: source
              ? `${row.description} — ${source}`
              : (row.description as string),
            category: row.category as string,
            linkHref: "/admin/expenses?tab=company",
          })
        }
      })(),
    )
  }

  if (layers.has("personal")) {
    queries.push(
      (async () => {
        const { data, error } = await supabase
          .from("personal_expenses")
          .select("*")
          .order("expense_date", { ascending: false })

        if (error) {
          if (isMissingFinanceTableError(error)) return
          throw error
        }

        for (const row of data ?? []) {
          const date = normalizeDateValue(row.expense_date)
          if (!date || !inDateRange(date, dateFrom, dateTo)) continue
          rows.push({
            id: `personal-expense-${row.id}`,
            date,
            direction: "out",
            layer: "personal",
            amount: Number(row.amount),
            description: row.description as string,
            category: row.category as string,
            linkHref: "/admin/expenses?tab=personal",
          })
        }
      })(),
    )
  }

  await Promise.all(queries)

  rows.sort((a, b) => {
    const d = b.date.localeCompare(a.date)
    if (d !== 0) return d
    return a.description.localeCompare(b.description)
  })

  const overview: AllExpensesOverview = {
    project: layers.has("project")
      ? sumLayer(rows, "project")
      : { expensesOut: 0, incomeIn: 0 },
    company: layers.has("company")
      ? sumLayer(rows, "company")
      : { expensesOut: 0, incomeIn: 0 },
    personal: layers.has("personal")
      ? sumLayer(rows, "personal")
      : { expensesOut: 0, incomeIn: 0 },
  }

  return { rows, overview }
}

export function parseExpenseLayers(
  param: string | null,
): Set<ExpenseLayer> {
  if (param === "") {
    return new Set()
  }
  if (!param) {
    return new Set(["project", "company", "personal"])
  }
  const parts = param.split(",").map((p) => p.trim())
  const layers = new Set<ExpenseLayer>()
  for (const p of parts) {
    if (p === "project" || p === "company" || p === "personal") {
      layers.add(p)
    }
  }
  if (layers.size === 0) {
    return new Set(["project", "company", "personal"])
  }
  return layers
}

export function periodToDateRange(period: string): {
  dateFrom: string
  dateTo: string
} {
  const to = new Date()
  const toStr = to.toISOString().slice(0, 10)
  const from = new Date(to)
  switch (period) {
    case "7d":
      from.setDate(from.getDate() - 7)
      break
    case "90d":
      from.setDate(from.getDate() - 90)
      break
    case "1y":
      from.setFullYear(from.getFullYear() - 1)
      break
    case "30d":
    default:
      from.setDate(from.getDate() - 30)
      break
  }
  return { dateFrom: from.toISOString().slice(0, 10), dateTo: toStr }
}
