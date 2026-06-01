import { Suspense } from "react"
import { ProjectDetailContent } from "@/components/projects/project-detail-content"
import { DashboardHeader } from "@/components/dashboard/header"
import { PAGE_MAIN_CLASS } from "@/components/layout/page"
import { PageShell } from "@/components/layout/page"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

function ProjectDetailFallback() {
  return (
    <main
      className={cn(
        PAGE_MAIN_CLASS,
        "flex min-h-[400px] items-center justify-center",
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </main>
  )
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <PageShell hideAppSidebar>
      <DashboardHeader hideAppNav />
      <Suspense fallback={<ProjectDetailFallback />}>
        <ProjectDetailContent projectId={id} />
      </Suspense>
    </PageShell>
  )
}
