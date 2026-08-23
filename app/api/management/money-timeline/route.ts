import {
  buildMoneyTimeline,
  filterMoneyTimeline,
  paginateMoneyTimeline,
} from "@/lib/money-timeline/build-timeline"
import { normalizeDateValue, unwrapProject } from "@/lib/money-timeline/dates"
import type { MoneyTimelineFilters } from "@/lib/money-timeline/types"
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
          "id, project_id, amount, received_date, created_at, projects(id, name)",
        )
        .eq("status", "received"),
      supabase
        .from("expenses")
        .select(
          "id, project_id, description, category, amount, expense_date, projects(id, name)",
        )
        .eq("status", "approved"),
      supabase
        .from("projects")
        .select("id, name")
        .neq("status", "archived")
        .order("name"),
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

    const activeProjectIds = new Set(
      (projectsResult.data ?? []).map((project) => project.id as string),
    )

    const payments = (paymentsResult.data ?? []).flatMap((row) => {
      if (!activeProjectIds.has(row.project_id as string)) return []
      const project = unwrapProject(row.projects)
      const date =
        normalizeDateValue(row.received_date) ??
        normalizeDateValue(row.created_at)
      if (!date) return []

      return [
        {
          id: row.id,
          projectId: row.project_id,
          projectName: project?.name ?? "Unknown project",
          amount: Number(row.amount),
          date,
        },
      ]
    })

    const expenses = (expensesResult.data ?? []).flatMap((row) => {
      if (!activeProjectIds.has(row.project_id as string)) return []
      const project = unwrapProject(row.projects)
      const date = normalizeDateValue(row.expense_date)
      if (!date) return []

      return [
        {
          id: row.id,
          projectId: row.project_id,
          projectName: project?.name ?? "Unknown project",
          description: row.description?.trim() || row.category || "Expense",
          amount: Number(row.amount),
          date,
        },
      ]
    })

    const timeline = buildMoneyTimeline(payments, expenses)
    const filtered = filterMoneyTimeline(timeline, filters)
    const { rows, total, hasMore } = paginateMoneyTimeline(filtered, offset, limit)

    return NextResponse.json({
      rows,
      total,
      offset,
      limit,
      hasMore,
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
