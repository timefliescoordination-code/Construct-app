import { Metadata } from "next"
import { CreateProjectForm } from "@/components/projects/create-project-form"
import { DashboardHeader } from "@/components/dashboard/header"

export const metadata: Metadata = {
  title: "Create Project | VRA HOMES",
  description: "Create a new construction project",
}

export default function NewProjectPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-6 md:px-6 lg:px-8 max-w-4xl">
        <CreateProjectForm />
      </main>
    </div>
  )
}
