import { EditProjectContent } from "@/components/projects/edit-project-content"

interface EditProjectPageProps {
  params: Promise<{ id: string }>
}

export default async function EditProjectPage({ params }: EditProjectPageProps) {
  const { id } = await params
  
  return <EditProjectContent projectId={id} />
}
