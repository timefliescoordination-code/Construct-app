import { buildCashFlowLedger } from "@/lib/cash-flow-ledger/allocation"
import type {
  ApprovedExpenseInput,
  CashFlowLedgerFilters,
  ReceivedPaymentInput,
} from "@/lib/cash-flow-ledger/types"
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

function parseFilters(searchParams: URLSearchParams): CashFlowLedgerFilters {
  const minAmount = searchParams.get("minAmount")
  const maxAmount = searchParams.get("maxAmount")
  const allocationStatus = searchParams.get("allocationStatus")

  return {
    dateFrom: searchParams.get("dateFrom") ?? undefined,
    dateTo: searchParams.get("dateTo") ?? undefined,
    client: searchParams.get("client") ?? undefined,
    projectId: searchParams.get("projectId") ?? undefined,
    minAmount: minAmount ? Number(minAmount) : undefined,
    maxAmount: maxAmount ? Number(maxAmount) : undefined,
    allocationStatus:
      allocationStatus === "fully_allocated" ||
      allocationStatus === "partially_allocated" ||
      allocationStatus === "unallocated"
        ? allocationStatus
        : allocationStatus === "all"
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
          "id, project_id, amount, received_date, created_at, stage_name, projects(id, name, client_name)",
        )
        .eq("status", "received")
        .order("received_date", { ascending: false, nullsFirst: false }),
      supabase
        .from("expenses")
        .select(
          "id, project_id, category, description, amount, expense_date, projects(id, name)",
        )
        .eq("status", "approved")
        .order("expense_date", { ascending: true }),
      supabase.from("projects").select("id, name, client_name").order("name"),
    ])

    const firstError =
      paymentsResult.error ?? expensesResult.error ?? projectsResult.error

    if (firstError) {
      console.error("[admin/cash-flow-ledger] query error:", firstError)
      return NextResponse.json(
        { error: getSupabaseErrorMessage(firstError) },
        { status: 500 },
      )
    }

    const payments: ReceivedPaymentInput[] = (paymentsResult.data ?? []).map(
      (row) => {
        const project = row.projects as {
          id: string
          name: string
          client_name: string
        } | null
        return {
          id: row.id,
          projectId: row.project_id,
          projectName: project?.name ?? "Unknown project",
          clientName: project?.client_name ?? "Unknown client",
          amount: Number(row.amount),
          receivedDate: row.received_date,
          createdAt: row.created_at,
          stageName: row.stage_name,
        }
      },
    )

    const expenses: ApprovedExpenseInput[] = (expensesResult.data ?? []).map(
      (row) => {
        const project = row.projects as { id: string; name: string } | null
        return {
          id: row.id,
          projectId: row.project_id,
          projectName: project?.name ?? "Unknown project",
          category: row.category,
          description: row.description,
          amount: Number(row.amount),
          expenseDate: row.expense_date,
        }
      },
    )

    const { summary, rows, total, hasMore } = buildCashFlowLedger(
      payments,
      expenses,
      filters,
      offset,
      limit,
    )

    const clients = [
      ...new Set(
        (projectsResult.data ?? [])
          .map((p) => p.client_name?.trim())
          .filter(Boolean),
      ),
    ].sort((a, b) => a.localeCompare(b))

    const projects = (projectsResult.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
    }))

    return NextResponse.json({
      summary,
      rows,
      total,
      offset,
      limit,
      hasMore,
      filterOptions: { clients, projects },
    })
  } catch (error) {
    console.error("[admin/cash-flow-ledger] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
