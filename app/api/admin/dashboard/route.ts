import { buildAdminDashboardData } from "@/lib/admin-dashboard-data"
import {
  activeProjectIdSet,
  excludeArchivedProjects,
  filterRowsByActiveProjects,
} from "@/lib/project-status"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"
import { NextResponse } from "next/server"

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

export async function GET() {
  try {
    const auth = await requireAdmin()
    if ("error" in auth && auth.error) {
      return auth.error
    }

    const { supabase } = auth

    const [
      projectsResult,
      milestonesResult,
      expensesResult,
      clientPaymentsResult,
      additionalWorksResult,
      vendorPaymentsResult,
      staffResult,
    ] = await Promise.all([
      supabase
        .from("projects")
        .select(
          "id, name, status, contract_value, expected_margin_percent, pm:profiles!pm_id(full_name, email)"
        )
        .order("created_at", { ascending: false }),
      supabase
        .from("milestones")
        .select(
          "project_id, name, expected_cost_percent, actual_completion_percent, target_budget, actual_expenses, status"
        ),
      supabase.from("expenses").select("project_id, amount").eq("status", "approved"),
      supabase.from("client_payments").select("project_id, amount, status"),
      supabase
        .from("additional_works")
        .select("project_id, amount")
        .eq("approval_status", "approved"),
      supabase.from("vendor_payments").select("project_id, pending_amount, status"),
      supabase
        .from("profiles")
        .select("id, email, full_name, role")
        .in("role", ["pm", "engineer"])
        .order("full_name", { ascending: true }),
    ])

    const firstError =
      projectsResult.error ??
      milestonesResult.error ??
      expensesResult.error ??
      clientPaymentsResult.error ??
      additionalWorksResult.error ??
      vendorPaymentsResult.error ??
      staffResult.error

    if (firstError) {
      console.error("[admin/dashboard] query error:", firstError)
      return NextResponse.json(
        { error: getSupabaseErrorMessage(firstError) },
        { status: 500 }
      )
    }

    const activeProjects = excludeArchivedProjects(projectsResult.data ?? [])
    const activeIds = activeProjectIdSet(activeProjects)

    const data = buildAdminDashboardData({
      projects: activeProjects,
      milestones: filterRowsByActiveProjects(milestonesResult.data ?? [], activeIds),
      expenses: filterRowsByActiveProjects(expensesResult.data ?? [], activeIds),
      clientPayments: filterRowsByActiveProjects(clientPaymentsResult.data ?? [], activeIds),
      additionalWorks: filterRowsByActiveProjects(additionalWorksResult.data ?? [], activeIds),
      vendorPayments: filterRowsByActiveProjects(vendorPaymentsResult.data ?? [], activeIds),
      staffProfiles: staffResult.data ?? [],
    })

    return NextResponse.json(data)
  } catch (error) {
    console.error("[admin/dashboard] unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
