import { Metadata } from "next"
import { CreateProjectForm } from "@/components/projects/create-project-form"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageMain, PageShell } from "@/components/layout/page"

export const metadata: Metadata = {
  title: "Create Project | VRA HOMES",
  description: "Create a new construction project",
}

export default function NewProjectPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain narrow>
        <CreateProjectForm />
      </PageMain>
    </PageShell>
  )
}
