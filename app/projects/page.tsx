import { DashboardHeader } from "@/components/dashboard/header"
import { PageMain, PageShell } from "@/components/layout/page"
import { ProjectsContent } from "@/components/projects/projects-content"

/** Avoid stale static HTML + mismatched JS/CSS after Hostinger redeploys. */
export const dynamic = "force-dynamic"

export default function ProjectsPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <ProjectsContent />
      </PageMain>
    </PageShell>
  )
}
