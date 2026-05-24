import type { Profile } from "@/lib/types/database"

export const PM_NOT_CREATED = "PM not created yet"
export const SITE_ENGINEER_NOT_CREATED = "Site engineer not created yet"
export const CUSTOMER_NOT_CREATED = "Customer not created yet"

type ProjectStaff = {
  pm?: Profile | null
  pm_id?: string | null
  project_engineers?: Array<{
    engineer_id: string
    engineer?: Profile | null
  }>
}

export function getProjectPmLabel(project: ProjectStaff): string {
  if (project.pm?.full_name?.trim()) {
    return project.pm.full_name
  }
  return PM_NOT_CREATED
}

export function getProjectEngineersLabel(project: ProjectStaff): string {
  const names = (project.project_engineers ?? [])
    .map((assignment) => assignment.engineer?.full_name?.trim())
    .filter((name): name is string => Boolean(name))

  if (names.length === 0) {
    return SITE_ENGINEER_NOT_CREATED
  }

  return names.join(", ")
}
