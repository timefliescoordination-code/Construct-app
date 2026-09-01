import { QUALITY_MIGRATIONS_HINT } from '@/lib/quality/constants'

const QUALITY_TABLE_PATTERN =
  /quality_checklist_templates|quality_checklist_template_items|quality_checklist_template_parameters|quality_project_checklists|quality_project_parameter_overrides|quality_inspections|quality_inspection_items|quality_inspection_parameter_results|quality_corrective_actions|quality_inspection_photos|quality_inspection_approvals|quality_inspection_audit_events/i

export function isMissingQualityTablesError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string }
  if (err.code !== 'PGRST205' && !err.message?.includes('Could not find the table')) {
    return false
  }
  return QUALITY_TABLE_PATTERN.test(err.message ?? '') || err.code === 'PGRST205'
}

export function qualityMissingTableMessage(error: unknown): string | null {
  if (!isMissingQualityTablesError(error)) return null
  const err = error as { message?: string }
  if (QUALITY_TABLE_PATTERN.test(err.message ?? '')) return QUALITY_MIGRATIONS_HINT
  if (err.message?.includes('Could not find the table')) return QUALITY_MIGRATIONS_HINT
  return null
}
