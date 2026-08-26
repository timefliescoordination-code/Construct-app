import { Suspense } from "react"
import { ProjectDetailContent } from "@/components/projects/project-detail-content"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageShell } from "@/components/layout/page"
import { ProjectDetailLoading } from "@/components/projects/project-detail-loading"

/** Avoid stale static HTML + mismatched JS/CSS after Hostinger redeploys. */
export const dynamic = "force-dynamic"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <PageShell hideAppSidebar>
      <DashboardHeader hideAppNav />
      <Suspense fallback={<ProjectDetailLoading />}>
        <ProjectDetailContent projectId={id} />
      </Suspense>
    </PageShell>
  )
}
