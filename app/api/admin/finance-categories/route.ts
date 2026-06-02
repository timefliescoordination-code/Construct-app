import { createClient } from "@/lib/supabase/server"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import {
  COMPANY_EXPENSE_CATEGORIES,
  COMPANY_INCOME_CATEGORIES,
  PERSONAL_EXPENSE_CATEGORIES,
} from "@/lib/finance/categories"
import type { FinanceCategoryKind } from "@/lib/types/database"
import { NextRequest, NextResponse } from "next/server"

const FALLBACK: Record<FinanceCategoryKind, readonly string[]> = {
  company_expense: COMPANY_EXPENSE_CATEGORIES,
  company_income: COMPANY_INCOME_CATEGORIES,
  personal_expense: PERSONAL_EXPENSE_CATEGORIES,
}

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

    const kindParam = request.nextUrl.searchParams.get("kind")
    const kinds: FinanceCategoryKind[] =
      kindParam === "company_expense" ||
      kindParam === "company_income" ||
      kindParam === "personal_expense"
        ? [kindParam]
        : ["company_expense", "company_income", "personal_expense"]

    let query = auth.supabase
      .from("finance_categories")
      .select("*")
      .in("kind", kinds)
      .order("sort_order", { ascending: true })

    const { data, error } = await query

    if (error) {
      const message = getSupabaseErrorMessage(error)
      if (message.toLowerCase().includes("does not exist")) {
        const byKind: Record<string, { id: string; kind: string; name: string }[]> =
          {}
        for (const kind of kinds) {
          byKind[kind] = FALLBACK[kind].map((name, i) => ({
            id: `fallback-${kind}-${i}`,
            kind,
            name,
          }))
        }
        return NextResponse.json({ categories: byKind, fallback: true })
      }
      return NextResponse.json({ error: message }, { status: 500 })
    }

    const byKind: Record<string, typeof data> = {}
    for (const kind of kinds) {
      byKind[kind] = (data ?? []).filter((row) => row.kind === kind)
    }

    for (const kind of kinds) {
      if ((byKind[kind]?.length ?? 0) === 0) {
        byKind[kind] = FALLBACK[kind].map((name, i) => ({
          id: `fallback-${kind}-${i}`,
          kind,
          name,
          sort_order: i + 1,
          created_at: "",
          updated_at: "",
        }))
      }
    }

    return NextResponse.json({ categories: byKind, fallback: false })
  } catch (err) {
    console.error("[admin/finance-categories]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
