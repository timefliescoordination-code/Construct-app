import { Metadata } from "next"
import { EngineerDashboard } from "@/components/engineer/engineer-dashboard"

export const metadata: Metadata = {
  title: "Site Engineer Dashboard | VRA HOMES",
  description: "Manage daily site activities and expenses",
}

export const dynamic = "force-dynamic"

export default function EngineerPage() {
  return <EngineerDashboard />
}
