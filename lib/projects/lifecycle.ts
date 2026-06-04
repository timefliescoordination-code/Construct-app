import type { ProjectLifecyclePhase } from '@/lib/types/database'

export function isConstructionActive(project: {
  lifecycle_phase?: ProjectLifecyclePhase | string | null
}): boolean {
  // Undefined = legacy projects before design phase (treated as construction)
  return project.lifecycle_phase !== 'design'
}

export function shouldUseLiveFinancials(project: {
  lifecycle_phase?: ProjectLifecyclePhase | string | null
}): boolean {
  return isConstructionActive(project)
}
