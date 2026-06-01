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

/** Display name from the project's Client Name field — never the linked customer's email. */
export function getProjectClientDisplayName(project: {
  client_name?: string | null
}): string {
  const name = project.client_name?.trim()
  return name || "—"
}

/** Suggest client name from a customer profile only when full_name is a real name, not their login email. */
export function profileNameForClientAutofill(profile: {
  full_name?: string | null
  email?: string | null
}): string | null {
  const name = profile.full_name?.trim()
  if (!name) return null
  const email = profile.email?.trim().toLowerCase()
  if (email && name.toLowerCase() === email) return null
  return name
}
