import { DashboardHeader } from "@/components/dashboard/header"
import { ProjectsContent } from "@/components/projects/projects-content"

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8">
        <ProjectsContent />
      </main>
    </div>
  )
}
