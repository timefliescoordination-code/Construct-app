import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { dashboardPath } from "@/lib/auth/dashboard-path"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()

  if (profile?.role !== "admin") {
    redirect(dashboardPath(profile?.role ?? null))
  }

  return children
}
