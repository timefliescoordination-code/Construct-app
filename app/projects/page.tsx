import { DashboardHeader } from "@/components/dashboard/header"
import { PageMain, PageShell } from "@/components/layout/page"
import { ProjectsContent } from "@/components/projects/projects-content"

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
