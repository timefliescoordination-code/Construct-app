import { Metadata } from "next"
import { CustomerDashboard } from "@/components/customer/customer-dashboard"

export const metadata: Metadata = {
  title: "Customer Dashboard | VRA HOMES",
  description: "View your project payments and progress",
}

export default function CustomerPage() {
  return <CustomerDashboard />
}
