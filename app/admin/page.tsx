import { Metadata } from "next"
import { AdminDashboard } from "@/components/admin/admin-dashboard"

export const metadata: Metadata = {
  title: "Admin Dashboard | VRA HOMES",
  description: "Company-wide financial overview and project management",
}

export default function AdminPage() {
  return <AdminDashboard />
}
