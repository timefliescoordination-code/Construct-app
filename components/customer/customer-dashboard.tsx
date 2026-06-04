"use client"

import { useState } from "react"
import { Loader2, PenLine, Hammer } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDefaultProject } from "@/lib/hooks/use-project-data"
import { NO_ASSIGNED_PROJECT_MESSAGE } from "@/lib/project-access"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import { CustomerDesignPanel } from "@/components/customer/customer-design-panel"
import { CustomerConstructionPanel } from "@/components/customer/customer-construction-panel"

type CustomerSection = "design" | "construction"

const SECTIONS: { id: CustomerSection; label: string; icon: typeof PenLine }[] = [
  { id: "design", label: "Design", icon: PenLine },
  { id: "construction", label: "Construction", icon: Hammer },
]

export function CustomerDashboard() {
  const { project, isLoading, error } = useDefaultProject()
  const [section, setSection] = useState<CustomerSection>("design")

  if (isLoading) {
    return (
      <PageShell>
        <DashboardHeader />
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading your project...</p>
          </div>
        </div>
      </PageShell>
    )
  }

  if (error || !project) {
    const message =
      error instanceof Error ? error.message : NO_ASSIGNED_PROJECT_MESSAGE
    return (
      <PageShell>
        <DashboardHeader />
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-2 px-6 py-24 text-center">
          <p className="text-muted-foreground">{message}</p>
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <DashboardHeader />

      <PageMain>
        <PageHeader
          title="My Project"
          description={
            project.client_name
              ? `${project.client_name} · ${project.site_address || "Site address pending"}`
              : "Review designs and track construction progress"
          }
        />

        <div className="flex flex-col gap-6 lg:flex-row">
          <aside className="lg:w-52 shrink-0">
            <nav className="flex flex-row gap-2 lg:flex-col">
              {SECTIONS.map((item) => {
                const Icon = item.icon
                const isActive = section === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "flex flex-1 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors lg:flex-none",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                )
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {section === "design" ? (
              <CustomerDesignPanel projectId={project.id} />
            ) : (
              <CustomerConstructionPanel project={project} />
            )}
          </div>
        </div>
      </PageMain>
    </PageShell>
  )
}
