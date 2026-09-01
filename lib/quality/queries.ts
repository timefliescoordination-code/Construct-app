import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { qualityMissingTableMessage } from '@/lib/quality/db'
import type {
  QualityChecklistTemplate,
  QualityChecklistTemplateDetail,
  QualityChecklistTemplateItemWithParams,
  QualityChecklistTemplateParameter,
  QualityCorrectiveAction,
  QualityInspectionApproval,
  QualityInspectionAuditEvent,
  QualityInspectionDetail,
  QualityInspectionItemDetail,
  QualityInspectionListRow,
  QualityInspectionParameterResult,
  QualityInspectionPhoto,
  QualityProjectChecklist,
  QualityProjectParameterOverride,
  QualitySelectOption,
} from '@/lib/types/database'
import type { QualityInspectionStatus } from '@/lib/quality/constants'

function mapError(error: unknown): Error {
  const missing = qualityMissingTableMessage(error)
  return new Error(missing ?? getSupabaseErrorMessage(error))
}

function asOptions(value: unknown): QualitySelectOption[] {
  if (!Array.isArray(value)) return []
  const options: QualitySelectOption[] = []
  for (const row of value) {
    if (!row || typeof row !== 'object') continue
    const rec = row as Record<string, unknown>
    if (typeof rec.value !== 'string' || typeof rec.label !== 'string') continue
    const result = rec.result === 'pass' || rec.result === 'fail' ? rec.result : undefined
    options.push({ value: rec.value, label: rec.label, result })
  }
  return options
}

function mapParameter(row: Record<string, unknown>): QualityChecklistTemplateParameter {
  return {
    id: String(row.id),
    item_id: String(row.item_id),
    name: String(row.name),
    parameter_type: row.parameter_type as QualityChecklistTemplateParameter['parameter_type'],
    unit: (row.unit as string | null) ?? null,
    requirement_label: (row.requirement_label as string | null) ?? null,
    expected_value: (row.expected_value as string | null) ?? null,
    min_value: row.min_value == null ? null : Number(row.min_value),
    max_value: row.max_value == null ? null : Number(row.max_value),
    options: asOptions(row.options),
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

function mapResultParameter(row: Record<string, unknown>): QualityInspectionParameterResult {
  return {
    id: String(row.id),
    inspection_item_id: String(row.inspection_item_id),
    template_parameter_id: (row.template_parameter_id as string | null) ?? null,
    name: String(row.name),
    parameter_type: row.parameter_type as QualityInspectionParameterResult['parameter_type'],
    unit: (row.unit as string | null) ?? null,
    requirement_label: (row.requirement_label as string | null) ?? null,
    expected_value: (row.expected_value as string | null) ?? null,
    min_value: row.min_value == null ? null : Number(row.min_value),
    max_value: row.max_value == null ? null : Number(row.max_value),
    options: asOptions(row.options),
    actual_value: (row.actual_value as string | null) ?? null,
    actual_numeric: row.actual_numeric == null ? null : Number(row.actual_numeric),
    status: row.status as QualityInspectionParameterResult['status'],
    sort_order: Number(row.sort_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export async function fetchPublishedTemplates(
  supabase: SupabaseClient,
): Promise<QualityChecklistTemplate[]> {
  const { data, error } = await supabase
    .from('quality_checklist_templates')
    .select('*')
    .eq('is_published', true)
    .order('name', { ascending: true })
    .order('version', { ascending: false })

  if (error) throw mapError(error)
  return (data ?? []) as QualityChecklistTemplate[]
}

export async function fetchAllTemplates(
  supabase: SupabaseClient,
): Promise<QualityChecklistTemplate[]> {
  const { data, error } = await supabase
    .from('quality_checklist_templates')
    .select('*')
    .order('name', { ascending: true })
    .order('version', { ascending: false })

  if (error) throw mapError(error)
  return (data ?? []) as QualityChecklistTemplate[]
}

export async function fetchTemplateDetail(
  supabase: SupabaseClient,
  templateId: string,
): Promise<QualityChecklistTemplateDetail | null> {
  const { data: template, error } = await supabase
    .from('quality_checklist_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle()

  if (error) throw mapError(error)
  if (!template) return null

  const { data: items, error: itemsError } = await supabase
    .from('quality_checklist_template_items')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true })

  if (itemsError) throw mapError(itemsError)

  const itemIds = (items ?? []).map((row) => row.id as string)
  let parameters: Record<string, unknown>[] = []
  if (itemIds.length > 0) {
    const { data: paramRows, error: paramError } = await supabase
      .from('quality_checklist_template_parameters')
      .select('*')
      .in('item_id', itemIds)
      .order('sort_order', { ascending: true })
    if (paramError) throw mapError(paramError)
    parameters = (paramRows ?? []) as Record<string, unknown>[]
  }

  const itemsWithParams: QualityChecklistTemplateItemWithParams[] = (items ?? []).map((item) => ({
    ...(item as QualityChecklistTemplateItemWithParams),
    parameters: parameters
      .filter((row) => String(row.item_id) === item.id)
      .map(mapParameter),
  }))

  return {
    ...(template as QualityChecklistTemplate),
    items: itemsWithParams,
  }
}

export async function fetchProjectChecklists(
  supabase: SupabaseClient,
  projectId: string,
): Promise<QualityProjectChecklist[]> {
  const { data, error } = await supabase
    .from('quality_project_checklists')
    .select('*, template:quality_checklist_templates(*), milestone:milestones(id, name)')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) throw mapError(error)
  return (data ?? []) as QualityProjectChecklist[]
}

export async function fetchProjectOverrides(
  supabase: SupabaseClient,
  projectId: string,
): Promise<QualityProjectParameterOverride[]> {
  const { data, error } = await supabase
    .from('quality_project_parameter_overrides')
    .select('*')
    .eq('project_id', projectId)

  if (error) throw mapError(error)
  return (data ?? []).map((row) => ({
    ...row,
    min_value: row.min_value == null ? null : Number(row.min_value),
    max_value: row.max_value == null ? null : Number(row.max_value),
  })) as QualityProjectParameterOverride[]
}

export async function fetchInspections(
  supabase: SupabaseClient,
  filters: {
    projectId?: string
    milestoneId?: string
    status?: QualityInspectionStatus | QualityInspectionStatus[]
    startedBy?: string
  } = {},
): Promise<QualityInspectionListRow[]> {
  let query = supabase
    .from('quality_inspections')
    .select(
      '*, project:projects(id, name), milestone:milestones(id, name), starter:profiles!started_by(id, full_name)',
    )
    .order('created_at', { ascending: false })

  if (filters.projectId) query = query.eq('project_id', filters.projectId)
  if (filters.milestoneId) query = query.eq('milestone_id', filters.milestoneId)
  if (filters.startedBy) query = query.eq('started_by', filters.startedBy)
  if (filters.status) {
    if (Array.isArray(filters.status)) query = query.in('status', filters.status)
    else query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw mapError(error)

  const inspections = (data ?? []) as QualityInspectionListRow[]
  if (inspections.length === 0) return inspections

  const ids = inspections.map((row) => row.id)
  const { data: failRows } = await supabase
    .from('quality_inspection_items')
    .select('inspection_id')
    .in('inspection_id', ids)
    .eq('status', 'fail')

  const { data: actionRows } = await supabase
    .from('quality_corrective_actions')
    .select('inspection_id')
    .in('inspection_id', ids)
    .neq('status', 'closed')

  const failCounts = new Map<string, number>()
  for (const row of failRows ?? []) {
    failCounts.set(row.inspection_id, (failCounts.get(row.inspection_id) ?? 0) + 1)
  }
  const actionCounts = new Map<string, number>()
  for (const row of actionRows ?? []) {
    actionCounts.set(row.inspection_id, (actionCounts.get(row.inspection_id) ?? 0) + 1)
  }

  return inspections.map((row) => ({
    ...row,
    failed_item_count: failCounts.get(row.id) ?? 0,
    open_action_count: actionCounts.get(row.id) ?? 0,
  }))
}

export async function fetchInspectionDetail(
  supabase: SupabaseClient,
  inspectionId: string,
): Promise<QualityInspectionDetail | null> {
  const { data: inspection, error } = await supabase
    .from('quality_inspections')
    .select(
      `*,
      project:projects(id, name, pm_id),
      milestone:milestones(id, name, status),
      template:quality_checklist_templates(id, name, work_type, version),
      starter:profiles!started_by(id, full_name),
      submitter:profiles!submitted_by(id, full_name),
      parent:quality_inspections!parent_inspection_id(id, inspection_number, status)`,
    )
    .eq('id', inspectionId)
    .maybeSingle()

  if (error) throw mapError(error)
  if (!inspection) return null

  const { data: items, error: itemsError } = await supabase
    .from('quality_inspection_items')
    .select('*')
    .eq('inspection_id', inspectionId)
    .order('sort_order', { ascending: true })
  if (itemsError) throw mapError(itemsError)

  const itemIds = (items ?? []).map((row) => row.id as string)

  const [{ data: parameters }, { data: actions }, { data: photos }, { data: approvals }, { data: audit }] =
    await Promise.all([
      itemIds.length
        ? supabase
            .from('quality_inspection_parameter_results')
            .select('*')
            .in('inspection_item_id', itemIds)
            .order('sort_order', { ascending: true })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase
        .from('quality_corrective_actions')
        .select('*, responsible_person:profiles!responsible_person_id(id, full_name)')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('quality_inspection_photos')
        .select('*, uploader:profiles!uploaded_by(id, full_name)')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('quality_inspection_approvals')
        .select('*, actor:profiles!actor_id(id, full_name)')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true }),
      supabase
        .from('quality_inspection_audit_events')
        .select('*, actor:profiles!actor_id(id, full_name)')
        .eq('inspection_id', inspectionId)
        .order('created_at', { ascending: true }),
    ])

  const itemDetails: QualityInspectionItemDetail[] = (items ?? []).map((item) => ({
    ...(item as QualityInspectionItemDetail),
    parameters: ((parameters ?? []) as Record<string, unknown>[])
      .filter((row) => String(row.inspection_item_id) === item.id)
      .map(mapResultParameter),
    corrective_actions: ((actions ?? []) as QualityCorrectiveAction[]).filter(
      (row) => row.inspection_item_id === item.id,
    ),
    photos: ((photos ?? []) as QualityInspectionPhoto[]).filter(
      (row) => row.inspection_item_id === item.id,
    ),
  }))

  return {
    ...(inspection as QualityInspectionDetail),
    items: itemDetails,
    photos: (photos ?? []) as QualityInspectionPhoto[],
    approvals: (approvals ?? []) as QualityInspectionApproval[],
    audit_events: (audit ?? []) as QualityInspectionAuditEvent[],
  }
}

export type QualityDashboardSummary = {
  completed: number
  pending: number
  failed: number
  openCorrectiveActions: number
  reinspectionPending: number
  approvalsPending: number
}

export function summarizeInspections(
  inspections: QualityInspectionListRow[],
): QualityDashboardSummary {
  return {
    completed: inspections.filter((row) =>
      ['approved', 'closed'].includes(row.status),
    ).length,
    pending: inspections.filter((row) =>
      ['draft', 'in_progress'].includes(row.status),
    ).length,
    failed: inspections.filter((row) =>
      ['failed', 'rejected'].includes(row.status),
    ).length,
    openCorrectiveActions: inspections.reduce(
      (sum, row) => sum + (row.open_action_count ?? 0),
      0,
    ),
    reinspectionPending: inspections.filter(
      (row) => row.status === 'ready_for_reinspection' || row.status === 'awaiting_correction',
    ).length,
    approvalsPending: inspections.filter((row) => row.status === 'submitted').length,
  }
}

export function matchTemplateToMilestoneName(
  templates: QualityChecklistTemplate[],
  milestoneName: string,
): QualityChecklistTemplate | null {
  const name = milestoneName.trim().toLowerCase()
  const published = templates.filter((row) => row.is_published)
  const exact = published.find((row) => row.name.toLowerCase() === name)
  if (exact) return exact
  const byType = published.find((row) => name.includes(row.work_type.replaceAll('_', ' ')))
  if (byType) return byType
  const bySlug = published.find((row) => name.includes(row.slug.replaceAll('_', ' ')))
  return bySlug ?? null
}
