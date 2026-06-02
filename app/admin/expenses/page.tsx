import { Metadata } from "next"
import { Suspense } from "react"
import { AllExpensesContent } from "@/components/finance/all-expenses-content"
import { Loader2 } from "lucide-react"

export const metadata: Metadata = {
  title: "All Expenses | VRA HOMES",
  description: "Unified project, company, and personal expenses",
}

function LoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

export default function AdminExpensesPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AllExpensesContent />
    </Suspense>
  )
}
