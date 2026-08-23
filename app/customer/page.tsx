import { Suspense } from "react"
import { Metadata } from "next"
import { CustomerDashboard } from "@/components/customer/customer-dashboard"
import { Loader2 } from "lucide-react"

export const metadata: Metadata = {
  title: "Customer Dashboard | VRA HOMES",
  description: "View your project payments and progress",
}

export const dynamic = "force-dynamic"

function CustomerDashboardFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function CustomerPage() {
  return (
    <Suspense fallback={<CustomerDashboardFallback />}>
      <CustomerDashboard />
    </Suspense>
  )
}
