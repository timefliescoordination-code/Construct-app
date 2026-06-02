import { createClient } from "@/lib/supabase/server"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import {
  fetchUnifiedMoneyFeed,
  parseExpenseLayers,
  periodToDateRange,
} from "@/lib/finance/unified-money-feed"
import { NextRequest, NextResponse } from "next/server"

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
    return {
      error: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    }
  }

  return { supabase }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin()
    if ("error" in auth && auth.error) {
      return auth.error
    }

    const searchParams = request.nextUrl.searchParams
    const period = searchParams.get("period") ?? "30d"
    const dateFromParam = searchParams.get("dateFrom")
    const dateToParam = searchParams.get("dateTo")

    const periodRange = periodToDateRange(period)
    const dateFrom = dateFromParam ?? periodRange.dateFrom
    const dateTo = dateToParam ?? periodRange.dateTo
    const layers = parseExpenseLayers(searchParams.get("layers"))

    const offset = Math.max(0, Number(searchParams.get("offset") ?? 0))
    const limit = Math.min(
      200,
      Math.max(1, Number(searchParams.get("limit") ?? 100)),
    )

    const { rows, overview } = await fetchUnifiedMoneyFeed(auth.supabase, {
      dateFrom,
      dateTo,
      layers,
    })

    const total = rows.length
    const pageRows = rows.slice(offset, offset + limit)

    const [companyList, companyIncomeList, personalList, projectsResult] =
      await Promise.all([
        auth.supabase
          .from("company_expenses")
          .select("*")
          .gte("expense_date", dateFrom)
          .lte("expense_date", dateTo)
          .order("expense_date", { ascending: false }),
        auth.supabase
          .from("company_income")
          .select("*")
          .gte("received_date", dateFrom)
          .lte("received_date", dateTo)
          .order("received_date", { ascending: false }),
        auth.supabase
          .from("personal_expenses")
          .select("*")
          .gte("expense_date", dateFrom)
          .lte("expense_date", dateTo)
          .order("expense_date", { ascending: false }),
        auth.supabase
          .from("projects")
          .select("id, name")
          .neq("status", "archived")
          .order("name"),
      ])

    const listError =
      companyList.error ??
      companyIncomeList.error ??
      personalList.error ??
      projectsResult.error
    if (listError) {
      return NextResponse.json(
        { error: getSupabaseErrorMessage(listError) },
        { status: 500 },
      )
    }

    return NextResponse.json({
      rows: pageRows,
      total,
      offset,
      limit,
      hasMore: offset + limit < total,
      overview,
      dateFrom,
      dateTo,
      companyExpenses: companyList.data ?? [],
      companyIncome: companyIncomeList.data ?? [],
      personalExpenses: personalList.data ?? [],
      projects: projectsResult.data ?? [],
    })
  } catch (error) {
    console.error("[admin/all-expenses] unexpected error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    )
  }
}
