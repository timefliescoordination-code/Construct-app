import { EditProjectContent } from "@/components/projects/edit-project-content"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageShell } from "@/components/layout/page"

interface EditProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params

  return (
    <PageShell hideAppSidebar>
      <DashboardHeader hideAppNav />
      <EditProjectContent projectId={id} />
    </PageShell>
  )
}
