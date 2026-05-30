import type {
  MoneyTimelineEntry,
  MoneyTimelineFilters,
} from "@/lib/money-timeline/types"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import { NextRequest, NextResponse } from "next/server"

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 100

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) }
  }

  return { supabase }
}

function parseFilters(searchParams: URLSearchParams): MoneyTimelineFilters {
  const type = searchParams.get("type")
  return {
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    type:
      type === "received" || type === "expense"
        ? type
        : type === "all"
          ? "all"
          : undefined,
  }
}

function matchesFilters(
  entry: MoneyTimelineEntry,
  filters: MoneyTimelineFilters,
): boolean {
  if (filters.dateFrom && entry.date < filters.dateFrom) return false
  if (filters.dateTo && entry.date > filters.dateTo) return false
  if (filters.projectId && entry.projectId !== filters.projectId) return false
  if (filters.type && filters.type !== "all" && entry.type !== filters.type) {
    return false
  }
  return true
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth && auth.error) {
      return auth.error
    }

    const { supabase } = auth
    const searchParams = request.nextUrl.searchParams
    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0))
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT)),
    )
    const filters = parseFilters(searchParams)

    const [paymentsResult, expensesResult, projectsResult] = await Promise.all([
      supabase
        .from("client_payments")
        .select(
          "id, project_id, amount, received_date, created_at, stage_name, projects(id, name)",
        )
        .eq("status", "received"),
      supabase
        .from("expenses")
        .select(
          "id, project_id, description, category, amount, expense_date, projects(id, name)",
        )
        .eq("status", "approved"),
      supabase.from("projects").select("id, name").order("name"),
    ])

    const firstError =
      paymentsResult.error ?? expensesResult.error ?? projectsResult.error

    if (firstError) {
      console.error("[admin/money-timeline] query error:", firstError)
      return NextResponse.json(
        { error: getSupabaseErrorMessage(firstError) },
        { status: 500 },
      )
    }

    const entries: MoneyTimelineEntry[] = []

    for (const row of paymentsResult.data ?? []) {
      const project = row.projects as { id: string; name: string } | null
      const projectName = project?.name ?? "Unknown project"
      entries.push({
        id: `payment-${row.id}`,
        date: row.received_date ?? row.created_at.slice(0, 10),
        type: "received",
        description: `${projectName} Payment Received`,
        projectId: row.project_id,
        projectName,
        amount: Number(row.amount),
      })
    }

    for (const row of expensesResult.data ?? []) {
      const project = row.projects as { id: string; name: string } | null
      const projectName = project?.name ?? "Unknown project"
      entries.push({
        id: `expense-${row.id}`,
        date: row.expense_date,
        type: "expense",
        description: row.description?.trim() || row.category,
        projectId: row.project_id,
        projectName,
        amount: Number(row.amount),
      })
    }

    entries.sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date)
      if (dateCompare !== 0) return dateCompare
      if (a.type !== b.type) return a.type === "received" ? -1 : 1
      return a.id.localeCompare(b.id)
    })

    const filtered = entries.filter((entry) => matchesFilters(entry, filters))
    const page = filtered.slice(offset, offset + limit)

    return NextResponse.json({
      rows: page,
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + limit < filtered.length,
      filterOptions: {
        projects: (projectsResult.data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
        })),
      },
    })
  } catch (error) {
    console.error("[admin/money-timeline] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
