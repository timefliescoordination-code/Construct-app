"use client"

import { useState } from "react"
import Link from "next/link"
import {
  Camera,
  FileText,
  FolderPlus,
  Receipt,
  Wallet,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AddExpenseMenu, type ProjectOption } from "@/components/finance/add-expense-menu"
import { ProjectPickerDialog } from "@/components/finance/project-picker-dialog"

export function QuickActions({
  projects,
  showCreateProject,
  isAdmin,
}: {
  projects: ProjectOption[]
  showCreateProject: boolean
  isAdmin: boolean
}) {
  const [picker, setPicker] = useState<null | "payments" | "photos" | "reports" | "vendor">(null)

  const hrefFor =
    picker === "photos"
      ? (id: string) => `/projects/${id}?tab=photos`
      : picker === "reports"
        ? (id: string) => `/projects/${id}?tab=reports`
        : (id: string) => `/projects/${id}?tab=payments`

  const title =
    picker === "photos"
      ? "Add site update"
      : picker === "reports"
        ? "Generate report"
        : picker === "vendor"
          ? "Add vendor bill"
          : "Record payment"

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {showCreateProject ? (
            <Button variant="outline" className="h-auto justify-start gap-2 px-3 py-2.5" asChild>
              <Link href="/projects/new">
                <FolderPlus className="h-4 w-4 shrink-0" />
                <span className="truncate text-xs sm:text-sm">New Project</span>
              </Link>
            </Button>
          ) : null}
          {isAdmin ? (
            <AddExpenseMenu projects={projects} variant="outline" className="h-auto w-full justify-start px-3 py-2.5" />
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-2 px-3 py-2.5"
            onClick={() => setPicker("payments")}
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Record Payment</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-2 px-3 py-2.5"
            onClick={() => setPicker("photos")}
          >
            <Camera className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Add Site Update</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-2 px-3 py-2.5"
            onClick={() => setPicker("vendor")}
          >
            <Receipt className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Add Vendor Bill</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-auto justify-start gap-2 px-3 py-2.5"
            onClick={() => setPicker("reports")}
          >
            <FileText className="h-4 w-4 shrink-0" />
            <span className="truncate text-xs sm:text-sm">Generate Report</span>
          </Button>
        </div>
        <ProjectPickerDialog
          open={picker != null}
          onOpenChange={(open) => {
            if (!open) setPicker(null)
          }}
          projects={projects}
          hrefForProject={hrefFor}
          title={title}
        />
      </CardContent>
    </Card>
  )
}
