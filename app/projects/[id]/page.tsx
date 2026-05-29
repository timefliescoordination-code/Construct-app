import { Suspense } from "react"
import { ProjectDetailContent } from "@/components/projects/project-detail-content"
import { DashboardHeader } from "@/components/dashboard/header"
import { Loader2 } from "lucide-react"

function ProjectDetailFallback() {
  return (
    <main className="flex min-h-[400px] items-center justify-center p-8">
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
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <Suspense fallback={<ProjectDetailFallback />}>
        <ProjectDetailContent projectId={id} />
      </Suspense>
    </div>
  )
}
