import { ProjectDetailContent } from "@/components/projects/project-detail-content"
import { DashboardHeader } from "@/components/dashboard/header"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <ProjectDetailContent projectId={id} />
    </div>
  )
}
