'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { qualityMissingTableMessage } from '@/lib/quality/db'
import {
  QUALITY_ITEM_STATUSES,
  type QualityInspectionStatus,
  type QualityItemStatus,
  type QualityPhotoLevel,
  type QualityApprovalDecision,
  type QualityCorrectiveStatus,
} from '@/lib/quality/constants'
import {
  canConfigureProjectQuality,
  canEditInspectionResults,
  canPerformInspection,
  canReviewInspection,
} from '@/lib/quality/workflow'
import {
  deriveInspectionStatus,
  deriveMilestoneQualityStatus,
  hasBlockingCriticalFailure,
  isInspectionLocked,
  uncheckedRequiredItems,
} from '@/lib/quality/status'
import { evaluateParameterStatus, parseNumericActual } from '@/lib/quality/validation'
import {
  fetchInspectionDetail,
  fetchProjectOverrides,
  fetchPublishedTemplates,
  fetchTemplateDetail,
  matchTemplateToMilestoneName,
} from '@/lib/quality/queries'
import {
  notifyEngineerOnQualityDecision,
  notifyStaffOnQualityInspectionSubmitted,
} from '@/lib/quality/notifications'
import { compressAndWatermarkSitePhoto } from '@/lib/site-photos/process'
import { getCompanyWatermarkDetails } from '@/lib/site-photos/company-watermark'
import { resolveSitePhotoMimeType, validateSitePhotoFile } from '@/lib/site-photos/validate'
import { uploadQualityPhotoFile } from '@/lib/quality/storage'
import type { UserRole } from '@/lib/types/database'
import type { QualitySelectOption } from '@/lib/quality/validation'

export type QualityActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

async function getSession() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, error: 'You must be signed in.' }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .maybeSingle()
  if (error) return { ok: false as const, error: getSupabaseErrorMessage(error) }

  const role = (profile?.role ?? null) as UserRole | null
  if (!role) return { ok: false as const, error: 'Your profile role is not set.' }
  if (role === 'customer') {
    return { ok: false as const, error: 'Quality inspections are not available for customer accounts.' }
  }

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    role,
    fullName: profile?.full_name ?? '',
  }
}

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: qualityMissingTableMessage(error) ?? getSupabaseErrorMessage(error) }
}

function revalidateQuality(projectId: string, inspectionId?: string) {
  revalidatePath('/inspections')
  if (inspectionId) revalidatePath(`/inspections/${inspectionId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/pm')
  revalidatePath('/engineer')
  revalidatePath('/admin')
}

async function assertProjectStaff(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  role: UserRole,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (role === 'admin') return { ok: true }
  const { data: project } = await supabase
    .from('projects')
    .select('id, pm_id')
    .eq('id', projectId)
    .maybeSingle()
  if (!project) return { ok: false, error: 'Project not found.' }
  if (role === 'pm' && project.pm_id === userId) return { ok: true }
  if (role === 'engineer') {
    const { data: assignment } = await supabase
      .from('project_engineers')
      .select('engineer_id')
      .eq('project_id', projectId)
      .eq('engineer_id', userId)
      .maybeSingle()
    if (assignment) return { ok: true }
  }
  return { ok: false, error: 'You do not have access to this project.' }
}

async function recordAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    inspectionId: string
    eventType: string
    fromStatus?: string | null
    toStatus?: string | null
    actorId: string
    actorRole: string
    comments?: string | null
    metadata?: Record<string, unknown> | null
  },
) {
  await supabase.from('quality_inspection_audit_events').insert({
    inspection_id: input.inspectionId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    comments: input.comments ?? null,
    metadata: input.metadata ?? null,
  })
}

async function syncMilestoneQualityStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  milestoneId: string,
) {
  const { data: milestone } = await supabase
    .from('milestones')
    .select('id, requires_quality_approval')
    .eq('id', milestoneId)
    .eq('project_id', projectId)
    .maybeSingle()
  if (!milestone) return

  const { data: inspections } = await supabase
    .from('quality_inspections')
    .select('status')
    .eq('milestone_id', milestoneId)

  const status = deriveMilestoneQualityStatus({
    requiresQualityApproval: Boolean(milestone.requires_quality_approval),
    inspections: (inspections ?? []).map((row) => ({
      status: row.status as QualityInspectionStatus,
    })),
  })

  await supabase
    .from('milestones')
    .update({ quality_approval_status: status })
    .eq('id', milestoneId)
}

export async function startInspectionAction(input: {
  projectId: string
  milestoneId: string
  templateId?: string
  locationLabel?: string | null
}): Promise<QualityActionResult<{ id: string; inspection_number: number }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPerformInspection(session.role)) {
    return { ok: false, error: 'You cannot start quality inspections.' }
  }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    input.projectId,
  )
  if (!access.ok) return access

  const { data: milestone, error: milestoneError } = await session.supabase
    .from('milestones')
    .select('id, name, project_id')
    .eq('id', input.milestoneId)
    .eq('project_id', input.projectId)
    .maybeSingle()
  if (milestoneError) return fail(milestoneError)
  if (!milestone) return { ok: false, error: 'Stage not found on this project.' }

  let templateId = input.templateId ?? null
  if (!templateId) {
    const { data: assignment } = await session.supabase
      .from('quality_project_checklists')
      .select('template_id')
      .eq('project_id', input.projectId)
      .eq('milestone_id', input.milestoneId)
      .maybeSingle()
    templateId = assignment?.template_id ?? null
  }
  if (!templateId) {
    try {
      const templates = await fetchPublishedTemplates(session.supabase)
      templateId = matchTemplateToMilestoneName(templates, milestone.name)?.id ?? null
    } catch (error) {
      return fail(error)
    }
  }
  if (!templateId) {
    return {
      ok: false,
      error: 'No checklist template is assigned to this stage. Ask an admin or PM to assign one.',
    }
  }

  let template
  try {
    template = await fetchTemplateDetail(session.supabase, templateId)
  } catch (error) {
    return fail(error)
  }
  if (!template || !template.is_published) {
    return { ok: false, error: 'Checklist template is not available.' }
  }
  if (template.items.length === 0) {
    return { ok: false, error: 'This checklist template has no items yet.' }
  }

  let overrides: Awaited<ReturnType<typeof fetchProjectOverrides>> = []
  try {
    overrides = await fetchProjectOverrides(session.supabase, input.projectId)
  } catch (error) {
    return fail(error)
  }
  const overrideByParam = new Map(overrides.map((row) => [row.template_parameter_id, row]))

  const { data: assignment } = await session.supabase
    .from('quality_project_checklists')
    .select('requires_pm_approval')
    .eq('project_id', input.projectId)
    .eq('milestone_id', input.milestoneId)
    .eq('template_id', template.id)
    .maybeSingle()

  const requiresPmApproval = assignment?.requires_pm_approval ?? template.requires_pm_approval
  const locationLabel = input.locationLabel?.trim() || null
  const workLabel = locationLabel
    ? `${template.name} — ${locationLabel}`
    : template.name

  const { data: inspectionNumber, error: numberError } = await session.supabase.rpc(
    'next_quality_inspection_number',
    { p_project_id: input.projectId },
  )
  if (numberError || inspectionNumber == null) {
    return fail(numberError ?? new Error('Failed to allocate inspection number.'))
  }

  const { data: inspection, error: insertError } = await session.supabase
    .from('quality_inspections')
    .insert({
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      template_id: template.id,
      template_version: template.version,
      inspection_number: inspectionNumber,
      work_label: workLabel,
      location_label: locationLabel,
      status: 'draft',
      requires_pm_approval: requiresPmApproval,
      started_by: session.userId,
    })
    .select('id, inspection_number')
    .single()

  if (insertError || !inspection) return fail(insertError)

  for (const item of template.items) {
    const { data: itemRow, error: itemError } = await session.supabase
      .from('quality_inspection_items')
      .insert({
        inspection_id: inspection.id,
        template_item_id: item.id,
        category_name: item.category_name,
        title: item.title,
        description: item.description,
        sort_order: item.sort_order,
        is_critical: item.is_critical,
        is_required: item.is_required,
        allow_na: item.allow_na,
        status: 'not_checked',
      })
      .select('id')
      .single()
    if (itemError || !itemRow) return fail(itemError)

    if (item.parameters.length === 0) continue
    const paramRows = item.parameters.map((parameter) => {
      const override = overrideByParam.get(parameter.id)
      return {
        inspection_item_id: itemRow.id,
        template_parameter_id: parameter.id,
        name: parameter.name,
        parameter_type: parameter.parameter_type,
        unit: override?.unit ?? parameter.unit,
        requirement_label: override?.requirement_label ?? parameter.requirement_label,
        expected_value: override?.expected_value ?? parameter.expected_value,
        min_value: override?.min_value ?? parameter.min_value,
        max_value: override?.max_value ?? parameter.max_value,
        options: parameter.options,
        sort_order: parameter.sort_order,
        status: 'not_checked',
      }
    })
    const { error: paramError } = await session.supabase
      .from('quality_inspection_parameter_results')
      .insert(paramRows)
    if (paramError) return fail(paramError)
  }

  if (requiresPmApproval) {
    await session.supabase
      .from('milestones')
      .update({ requires_quality_approval: true })
      .eq('id', input.milestoneId)
  }

  await recordAudit(session.supabase, {
    inspectionId: inspection.id,
    eventType: 'created',
    toStatus: 'draft',
    actorId: session.userId,
    actorRole: session.role,
    comments: `Started ${workLabel}`,
    metadata: { template_id: template.id, template_version: template.version },
  })
  await syncMilestoneQualityStatus(session.supabase, input.projectId, input.milestoneId)
  revalidateQuality(input.projectId, inspection.id)

  return {
    ok: true,
    data: { id: inspection.id as string, inspection_number: Number(inspection.inspection_number) },
  }
}

export async function saveInspectionItemAction(input: {
  inspectionId: string
  itemId: string
  status: QualityItemStatus
  remark?: string | null
}): Promise<QualityActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!QUALITY_ITEM_STATUSES.includes(input.status)) {
    return { ok: false, error: 'Invalid checklist status.' }
  }

  const { data: inspection, error } = await session.supabase
    .from('quality_inspections')
    .select('id, project_id, milestone_id, status')
    .eq('id', input.inspectionId)
    .maybeSingle()
  if (error) return fail(error)
  if (!inspection) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    inspection.project_id,
  )
  if (!access.ok) return access
  if (!canEditInspectionResults(session.role, inspection.status as QualityInspectionStatus)) {
    return { ok: false, error: 'This inspection can no longer be edited.' }
  }

  const { data: item } = await session.supabase
    .from('quality_inspection_items')
    .select('id, allow_na, is_critical')
    .eq('id', input.itemId)
    .eq('inspection_id', input.inspectionId)
    .maybeSingle()
  if (!item) return { ok: false, error: 'Checklist item not found.' }
  if (input.status === 'na' && !item.allow_na) {
    return { ok: false, error: 'This item cannot be marked N/A.' }
  }

  const { error: updateError } = await session.supabase
    .from('quality_inspection_items')
    .update({
      status: input.status,
      remark: input.remark?.trim() || null,
    })
    .eq('id', input.itemId)
  if (updateError) return fail(updateError)

  const nextStatus = await refreshInspectionProgress(session.supabase, inspection.id)
  await recordAudit(session.supabase, {
    inspectionId: inspection.id,
    eventType: 'item_result',
    fromStatus: inspection.status,
    toStatus: nextStatus,
    actorId: session.userId,
    actorRole: session.role,
    metadata: { item_id: input.itemId, status: input.status, critical: item.is_critical },
  })
  await syncMilestoneQualityStatus(session.supabase, inspection.project_id, inspection.milestone_id)
  revalidateQuality(inspection.project_id, inspection.id)
  return { ok: true, data: undefined }
}

export async function saveInspectionParameterAction(input: {
  inspectionId: string
  parameterId: string
  actualValue: string
  status?: QualityItemStatus | null
}): Promise<QualityActionResult<{ status: QualityItemStatus }>> {
  const session = await getSession()
  if (!session.ok) return session

  const { data: inspection } = await session.supabase
    .from('quality_inspections')
    .select('id, project_id, milestone_id, status')
    .eq('id', input.inspectionId)
    .maybeSingle()
  if (!inspection) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    inspection.project_id,
  )
  if (!access.ok) return access
  if (!canEditInspectionResults(session.role, inspection.status as QualityInspectionStatus)) {
    return { ok: false, error: 'This inspection can no longer be edited.' }
  }

  const { data: parameter } = await session.supabase
    .from('quality_inspection_parameter_results')
    .select('*')
    .eq('id', input.parameterId)
    .maybeSingle()
  if (!parameter) return { ok: false, error: 'Technical parameter not found.' }

  const autoStatus = evaluateParameterStatus({
    parameter_type: parameter.parameter_type,
    actual_value: input.actualValue,
    expected_value: parameter.expected_value,
    min_value: parameter.min_value == null ? null : Number(parameter.min_value),
    max_value: parameter.max_value == null ? null : Number(parameter.max_value),
    options: (parameter.options ?? []) as QualitySelectOption[],
  })
  const status = (input.status ?? autoStatus ?? 'not_checked') as QualityItemStatus
  const numeric = parseNumericActual(input.actualValue)

  const { error: updateError } = await session.supabase
    .from('quality_inspection_parameter_results')
    .update({
      actual_value: input.actualValue.trim() || null,
      actual_numeric: numeric,
      status,
    })
    .eq('id', input.parameterId)
  if (updateError) return fail(updateError)

  if (status === 'fail') {
    await session.supabase
      .from('quality_inspection_items')
      .update({ status: 'fail' })
      .eq('id', parameter.inspection_item_id)
      .neq('status', 'fail')
  }

  await refreshInspectionProgress(session.supabase, inspection.id)
  await syncMilestoneQualityStatus(session.supabase, inspection.project_id, inspection.milestone_id)
  revalidateQuality(inspection.project_id, inspection.id)
  return { ok: true, data: { status } }
}

export async function saveCorrectiveActionAction(input: {
  inspectionId: string
  itemId: string
  remark: string
  correctiveAction: string
  responsiblePersonId?: string | null
  targetDate?: string | null
  status?: QualityCorrectiveStatus
}): Promise<QualityActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session.ok) return session

  const { data: inspection } = await session.supabase
    .from('quality_inspections')
    .select('id, project_id, milestone_id, status')
    .eq('id', input.inspectionId)
    .maybeSingle()
  if (!inspection) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    inspection.project_id,
  )
  if (!access.ok) return access
  if (!canEditInspectionResults(session.role, inspection.status as QualityInspectionStatus)) {
    return { ok: false, error: 'This inspection can no longer be edited.' }
  }

  const { data: existing } = await session.supabase
    .from('quality_corrective_actions')
    .select('id')
    .eq('inspection_item_id', input.itemId)
    .neq('status', 'closed')
    .maybeSingle()

  const payload = {
    remark: input.remark.trim() || null,
    corrective_action: input.correctiveAction.trim() || null,
    responsible_person_id: input.responsiblePersonId || null,
    target_date: input.targetDate || null,
    status: input.status ?? 'open',
  }

  let actionId = existing?.id as string | undefined
  if (existing) {
    const { error } = await session.supabase
      .from('quality_corrective_actions')
      .update(payload)
      .eq('id', existing.id)
    if (error) return fail(error)
  } else {
    const { data, error } = await session.supabase
      .from('quality_corrective_actions')
      .insert({
        project_id: inspection.project_id,
        inspection_id: inspection.id,
        inspection_item_id: input.itemId,
        created_by: session.userId,
        ...payload,
      })
      .select('id')
      .single()
    if (error || !data) return fail(error)
    actionId = data.id
  }

  await refreshInspectionProgress(session.supabase, inspection.id)
  await recordAudit(session.supabase, {
    inspectionId: inspection.id,
    eventType: 'corrective_action',
    actorId: session.userId,
    actorRole: session.role,
    comments: payload.remark,
    metadata: { item_id: input.itemId, status: payload.status },
  })
  await syncMilestoneQualityStatus(session.supabase, inspection.project_id, inspection.milestone_id)
  revalidateQuality(inspection.project_id, inspection.id)
  return { ok: true, data: { id: actionId! } }
}

export async function submitInspectionAction(input: {
  inspectionId: string
}): Promise<QualityActionResult<{ status: QualityInspectionStatus }>> {
  const session = await getSession()
  if (!session.ok) return session

  let detail
  try {
    detail = await fetchInspectionDetail(session.supabase, input.inspectionId)
  } catch (error) {
    return fail(error)
  }
  if (!detail) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    detail.project_id,
  )
  if (!access.ok) return access
  if (!canEditInspectionResults(session.role, detail.status)) {
    return { ok: false, error: 'This inspection can no longer be submitted.' }
  }

  const missing = uncheckedRequiredItems(detail.items)
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Mark all required items before submitting (${missing.length} remaining).`,
    }
  }

  const naAbuse = detail.items.find((item) => item.status === 'na' && !item.allow_na)
  if (naAbuse) {
    return { ok: false, error: `${naAbuse.title} cannot be marked N/A.` }
  }

  const failures = detail.items.filter((item) => item.status === 'fail')
  for (const item of failures) {
    const action = item.corrective_actions.find((row) => row.status !== 'closed')
    if (!action || !(action.remark || action.corrective_action)) {
      return {
        ok: false,
        error: `Add a remark and corrective action for failed item: ${item.title}.`,
      }
    }
  }

  const nextStatus = deriveInspectionStatus({
    items: detail.items,
    correctiveActions: detail.items.flatMap((item) => item.corrective_actions),
    currentStatus: detail.status,
    intent: 'submit',
  })

  const overallResult = failures.length > 0 ? 'fail' : 'pass'
  const { error } = await session.supabase
    .from('quality_inspections')
    .update({
      status: nextStatus,
      overall_result: overallResult,
      submitted_by: session.userId,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', detail.id)
  if (error) return fail(error)

  await recordAudit(session.supabase, {
    inspectionId: detail.id,
    eventType: 'submitted',
    fromStatus: detail.status,
    toStatus: nextStatus,
    actorId: session.userId,
    actorRole: session.role,
  })
  await syncMilestoneQualityStatus(session.supabase, detail.project_id, detail.milestone_id)

  if (nextStatus === 'submitted') {
    await notifyStaffOnQualityInspectionSubmitted({
      projectId: detail.project_id,
      projectName: detail.project?.name ?? 'Project',
      inspectionId: detail.id,
      inspectionNumber: detail.inspection_number,
      workLabel: detail.work_label,
    })
  }

  revalidateQuality(detail.project_id, detail.id)
  return { ok: true, data: { status: nextStatus } }
}

export async function requestReinspectionAction(input: {
  inspectionId: string
}): Promise<QualityActionResult<{ id: string; inspection_number: number }>> {
  const session = await getSession()
  if (!session.ok) return session

  let original
  try {
    original = await fetchInspectionDetail(session.supabase, input.inspectionId)
  } catch (error) {
    return fail(error)
  }
  if (!original) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    original.project_id,
  )
  if (!access.ok) return access
  if (!canPerformInspection(session.role)) {
    return { ok: false, error: 'You cannot request reinspection.' }
  }
  if (isInspectionLocked(original.status) && original.status === 'approved') {
    return { ok: false, error: 'Approved inspections cannot be reinspected. Start a new inspection instead.' }
  }
  if (!['failed', 'awaiting_correction', 'ready_for_reinspection', 'rejected'].includes(original.status)) {
    return { ok: false, error: 'Reinspection is only available after a failed inspection or correction request.' }
  }

  const { data: inspectionNumber, error: numberError } = await session.supabase.rpc(
    'next_quality_inspection_number',
    { p_project_id: original.project_id },
  )
  if (numberError || inspectionNumber == null) return fail(numberError)

  const { data: created, error: insertError } = await session.supabase
    .from('quality_inspections')
    .insert({
      project_id: original.project_id,
      milestone_id: original.milestone_id,
      template_id: original.template_id,
      template_version: original.template_version,
      inspection_number: inspectionNumber,
      parent_inspection_id: original.id,
      work_label: original.work_label,
      location_label: original.location_label,
      status: 'in_progress',
      requires_pm_approval: original.requires_pm_approval,
      started_by: session.userId,
    })
    .select('id, inspection_number')
    .single()
  if (insertError || !created) return fail(insertError)

  for (const item of original.items) {
    const copiedStatus = item.status === 'fail' ? 'not_checked' : item.status
    const { data: itemRow, error: itemError } = await session.supabase
      .from('quality_inspection_items')
      .insert({
        inspection_id: created.id,
        template_item_id: item.template_item_id,
        category_name: item.category_name,
        title: item.title,
        description: item.description,
        sort_order: item.sort_order,
        is_critical: item.is_critical,
        is_required: item.is_required,
        allow_na: item.allow_na,
        status: copiedStatus,
        remark: copiedStatus === 'not_checked' ? null : item.remark,
      })
      .select('id')
      .single()
    if (itemError || !itemRow) return fail(itemError)

    if (item.parameters.length === 0) continue
    const { error: paramError } = await session.supabase
      .from('quality_inspection_parameter_results')
      .insert(
        item.parameters.map((parameter) => ({
          inspection_item_id: itemRow.id,
          template_parameter_id: parameter.template_parameter_id,
          name: parameter.name,
          parameter_type: parameter.parameter_type,
          unit: parameter.unit,
          requirement_label: parameter.requirement_label,
          expected_value: parameter.expected_value,
          min_value: parameter.min_value,
          max_value: parameter.max_value,
          options: parameter.options,
          actual_value: item.status === 'fail' ? null : parameter.actual_value,
          actual_numeric: item.status === 'fail' ? null : parameter.actual_numeric,
          status: item.status === 'fail' ? 'not_checked' : parameter.status,
          sort_order: parameter.sort_order,
        })),
      )
    if (paramError) return fail(paramError)
  }

  await session.supabase
    .from('quality_inspections')
    .update({ status: original.status === 'rejected' ? 'rejected' : 'failed' })
    .eq('id', original.id)

  await recordAudit(session.supabase, {
    inspectionId: original.id,
    eventType: 'reinspection_requested',
    fromStatus: original.status,
    toStatus: original.status,
    actorId: session.userId,
    actorRole: session.role,
    metadata: { reinspection_id: created.id },
  })
  await recordAudit(session.supabase, {
    inspectionId: created.id,
    eventType: 'created',
    toStatus: 'in_progress',
    actorId: session.userId,
    actorRole: session.role,
    comments: `Reinspection of #${original.inspection_number}`,
    metadata: { parent_inspection_id: original.id },
  })
  await syncMilestoneQualityStatus(session.supabase, original.project_id, original.milestone_id)
  revalidateQuality(original.project_id, created.id)
  return {
    ok: true,
    data: { id: created.id as string, inspection_number: Number(created.inspection_number) },
  }
}

export async function reviewInspectionAction(input: {
  inspectionId: string
  decision: QualityApprovalDecision
  remark?: string | null
}): Promise<QualityActionResult<{ status: QualityInspectionStatus }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canReviewInspection(session.role)) {
    return { ok: false, error: 'Only the project manager or admin can review inspections.' }
  }

  let detail
  try {
    detail = await fetchInspectionDetail(session.supabase, input.inspectionId)
  } catch (error) {
    return fail(error)
  }
  if (!detail) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    detail.project_id,
  )
  if (!access.ok) return access
  if (detail.status === 'approved') {
    return { ok: false, error: 'Approved inspections cannot be changed. History is preserved.' }
  }

  if (input.decision === 'approved') {
    if (hasBlockingCriticalFailure(detail.items)) {
      return { ok: false, error: 'Critical failed items must be resolved before approval.' }
    }
    if (detail.items.some((item) => item.status === 'fail')) {
      return { ok: false, error: 'Failed items must be corrected and reinspected before approval.' }
    }
    if (detail.items.some((item) => item.is_required && item.status === 'not_checked')) {
      return { ok: false, error: 'Required items are still unchecked.' }
    }
  }

  const nextStatus: QualityInspectionStatus =
    input.decision === 'approved'
      ? 'approved'
      : input.decision === 'rejected'
        ? 'rejected'
        : 'awaiting_correction'

  const { error } = await session.supabase
    .from('quality_inspections')
    .update({
      status: nextStatus,
      overall_result: input.decision === 'approved' ? 'pass' : detail.overall_result,
      locked_at: input.decision === 'approved' || input.decision === 'rejected'
        ? new Date().toISOString()
        : null,
    })
    .eq('id', detail.id)
  if (error) return fail(error)

  await session.supabase.from('quality_inspection_approvals').insert({
    inspection_id: detail.id,
    decision: input.decision,
    remark: input.remark?.trim() || null,
    actor_id: session.userId,
    actor_role: session.role,
  })

  await recordAudit(session.supabase, {
    inspectionId: detail.id,
    eventType: input.decision,
    fromStatus: detail.status,
    toStatus: nextStatus,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.remark,
  })

  if (input.decision === 'approved') {
    await session.supabase
      .from('quality_corrective_actions')
      .update({ status: 'closed' })
      .eq('inspection_id', detail.id)
      .neq('status', 'closed')
  }

  await syncMilestoneQualityStatus(session.supabase, detail.project_id, detail.milestone_id)
  await notifyEngineerOnQualityDecision(session.supabase, {
    projectId: detail.project_id,
    inspectionId: detail.id,
    engineerId: detail.started_by,
    decision: input.decision,
    inspectionNumber: detail.inspection_number,
  })
  revalidateQuality(detail.project_id, detail.id)
  return { ok: true, data: { status: nextStatus } }
}

export async function uploadInspectionPhotoAction(
  formData: FormData,
): Promise<QualityActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session.ok) return session

  const inspectionId = String(formData.get('inspectionId') ?? '')
  const itemId = String(formData.get('itemId') ?? '') || null
  const correctiveActionId = String(formData.get('correctiveActionId') ?? '') || null
  const level = (String(formData.get('level') ?? 'item') as QualityPhotoLevel)
  const file = formData.get('file')
  if (!inspectionId) return { ok: false, error: 'Inspection ID is required.' }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Select a photo to upload.' }
  }
  const validation = validateSitePhotoFile(file)
  if (!validation.valid) return { ok: false, error: validation.error ?? 'Invalid photo.' }

  const { data: inspection } = await session.supabase
    .from('quality_inspections')
    .select('id, project_id, milestone_id, status')
    .eq('id', inspectionId)
    .maybeSingle()
  if (!inspection) return { ok: false, error: 'Inspection not found.' }

  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    inspection.project_id,
  )
  if (!access.ok) return access
  if (!canEditInspectionResults(session.role, inspection.status as QualityInspectionStatus)) {
    return { ok: false, error: 'Photos cannot be added to a locked inspection.' }
  }

  const { data: companyDetails, error: companyError } = await getCompanyWatermarkDetails(
    session.supabase,
  )
  const photoId = crypto.randomUUID()
  const sourceMimeType = resolveSitePhotoMimeType(file)
  const inputBuffer = Buffer.from(await file.arrayBuffer())
  const processed = await compressAndWatermarkSitePhoto(
    inputBuffer,
    companyDetails?.watermarkText ?? session.fullName,
    sourceMimeType,
  )
  if (companyError && !companyDetails) {
    // Watermark with the uploader name if company details are missing.
  }

  const upload = await uploadQualityPhotoFile(session.supabase, {
    projectId: inspection.project_id,
    inspectionId: inspection.id,
    photoId,
    mimeType: processed.contentType,
    fileBuffer: processed.buffer,
  })
  if ('error' in upload) return { ok: false, error: upload.error }

  const { error } = await session.supabase.from('quality_inspection_photos').insert({
    id: photoId,
    project_id: inspection.project_id,
    inspection_id: inspection.id,
    inspection_item_id: itemId,
    corrective_action_id: correctiveActionId,
    level: ['inspection', 'item', 'failure'].includes(level) ? level : 'item',
    file_path: upload.filePath,
    file_name: file.name,
    file_mime_type: processed.contentType,
    uploaded_by: session.userId,
  })
  if (error) return fail(error)

  await recordAudit(session.supabase, {
    inspectionId: inspection.id,
    eventType: 'photo_uploaded',
    actorId: session.userId,
    actorRole: session.role,
    metadata: { photo_id: photoId, level, item_id: itemId },
  })
  revalidateQuality(inspection.project_id, inspection.id)
  return { ok: true, data: { id: photoId } }
}

export async function assignProjectChecklistAction(input: {
  projectId: string
  milestoneId: string
  templateId: string
  requiresPmApproval: boolean
}): Promise<QualityActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canConfigureProjectQuality(session.role)) {
    return { ok: false, error: 'Only admin or PM can assign checklists to a stage.' }
  }
  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    input.projectId,
  )
  if (!access.ok) return access

  const { data: template } = await session.supabase
    .from('quality_checklist_templates')
    .select('id, version, requires_pm_approval')
    .eq('id', input.templateId)
    .maybeSingle()
  if (!template) return { ok: false, error: 'Template not found.' }

  const { error } = await session.supabase.from('quality_project_checklists').upsert(
    {
      project_id: input.projectId,
      milestone_id: input.milestoneId,
      template_id: template.id,
      template_version: template.version,
      requires_pm_approval: input.requiresPmApproval,
      created_by: session.userId,
    },
    { onConflict: 'project_id,milestone_id,template_id' },
  )
  if (error) return fail(error)

  await session.supabase
    .from('milestones')
    .update({
      requires_quality_approval: input.requiresPmApproval,
      quality_approval_status: input.requiresPmApproval ? 'pending' : 'not_required',
    })
    .eq('id', input.milestoneId)
    .eq('project_id', input.projectId)

  revalidateQuality(input.projectId)
  return { ok: true, data: undefined }
}

export async function saveProjectParameterOverrideAction(input: {
  projectId: string
  templateParameterId: string
  requirementLabel?: string | null
  expectedValue?: string | null
  minValue?: number | null
  maxValue?: number | null
  unit?: string | null
}): Promise<QualityActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canConfigureProjectQuality(session.role)) {
    return { ok: false, error: 'Only admin or PM can override project requirements.' }
  }
  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    input.projectId,
  )
  if (!access.ok) return access

  const { error } = await session.supabase.from('quality_project_parameter_overrides').upsert(
    {
      project_id: input.projectId,
      template_parameter_id: input.templateParameterId,
      requirement_label: input.requirementLabel?.trim() || null,
      expected_value: input.expectedValue?.trim() || null,
      min_value: input.minValue ?? null,
      max_value: input.maxValue ?? null,
      unit: input.unit?.trim() || null,
      created_by: session.userId,
    },
    { onConflict: 'project_id,template_parameter_id' },
  )
  if (error) return fail(error)
  revalidateQuality(input.projectId)
  return { ok: true, data: undefined }
}

export async function updateTemplateMetaAction(input: {
  templateId: string
  name: string
  description?: string | null
  requiresPmApproval: boolean
  isPublished: boolean
}): Promise<QualityActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'admin') {
    return { ok: false, error: 'Only admin can manage checklist templates.' }
  }

  const { data: current } = await session.supabase
    .from('quality_checklist_templates')
    .select('version')
    .eq('id', input.templateId)
    .maybeSingle()
  if (!current) return { ok: false, error: 'Template not found.' }

  const { error } = await session.supabase
    .from('quality_checklist_templates')
    .update({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      requires_pm_approval: input.requiresPmApproval,
      is_published: input.isPublished,
      version: Number(current.version) + 1,
    })
    .eq('id', input.templateId)
  if (error) return fail(error)
  revalidatePath('/admin/settings/checklists')
  return { ok: true, data: undefined }
}

export async function updateTemplateParameterAction(input: {
  parameterId: string
  requirementLabel?: string | null
  expectedValue?: string | null
  minValue?: number | null
  maxValue?: number | null
  unit?: string | null
  isCriticalItem?: boolean
  itemId?: string
}): Promise<QualityActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'admin') {
    return { ok: false, error: 'Only admin can manage checklist templates.' }
  }

  const { error } = await session.supabase
    .from('quality_checklist_template_parameters')
    .update({
      requirement_label: input.requirementLabel?.trim() || null,
      expected_value: input.expectedValue?.trim() || null,
      min_value: input.minValue ?? null,
      max_value: input.maxValue ?? null,
      unit: input.unit?.trim() || null,
    })
    .eq('id', input.parameterId)
  if (error) return fail(error)

  if (input.itemId && input.isCriticalItem != null) {
    await session.supabase
      .from('quality_checklist_template_items')
      .update({ is_critical: input.isCriticalItem })
      .eq('id', input.itemId)
  }

  const { data: parameter } = await session.supabase
    .from('quality_checklist_template_parameters')
    .select('item_id')
    .eq('id', input.parameterId)
    .maybeSingle()
  if (parameter) {
    const { data: item } = await session.supabase
      .from('quality_checklist_template_items')
      .select('template_id')
      .eq('id', parameter.item_id)
      .maybeSingle()
    if (item?.template_id) {
      const { data: template } = await session.supabase
        .from('quality_checklist_templates')
        .select('version')
        .eq('id', item.template_id)
        .maybeSingle()
      if (template) {
        await session.supabase
          .from('quality_checklist_templates')
          .update({ version: Number(template.version) + 1 })
          .eq('id', item.template_id)
      }
    }
  }

  revalidatePath('/admin/settings/checklists')
  return { ok: true, data: undefined }
}

export async function updateTemplateItemFlagsAction(input: {
  itemId: string
  isCritical: boolean
  isRequired: boolean
  allowNa: boolean
}): Promise<QualityActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'admin') {
    return { ok: false, error: 'Only admin can manage checklist templates.' }
  }
  const { error } = await session.supabase
    .from('quality_checklist_template_items')
    .update({
      is_critical: input.isCritical,
      is_required: input.isRequired,
      allow_na: input.allowNa,
    })
    .eq('id', input.itemId)
  if (error) return fail(error)
  revalidatePath('/admin/settings/checklists')
  return { ok: true, data: undefined }
}

async function refreshInspectionProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  inspectionId: string,
): Promise<QualityInspectionStatus> {
  const { data: inspection } = await supabase
    .from('quality_inspections')
    .select('status')
    .eq('id', inspectionId)
    .maybeSingle()
  const current = (inspection?.status ?? 'draft') as QualityInspectionStatus
  if (isInspectionLocked(current) || current === 'submitted') return current

  const { data: items } = await supabase
    .from('quality_inspection_items')
    .select('status, is_critical, is_required, allow_na')
    .eq('inspection_id', inspectionId)
  const { data: actions } = await supabase
    .from('quality_corrective_actions')
    .select('status')
    .eq('inspection_id', inspectionId)

  const next = deriveInspectionStatus({
    items: (items ?? []).map((row) => ({
      status: row.status as QualityItemStatus,
      is_critical: Boolean(row.is_critical),
      is_required: Boolean(row.is_required),
      allow_na: Boolean(row.allow_na),
    })),
    correctiveActions: (actions ?? []).map((row) => ({
      status: row.status as QualityCorrectiveStatus,
    })),
    currentStatus: current,
    intent: current === 'failed' || current === 'awaiting_correction' || current === 'ready_for_reinspection'
      ? 'submit'
      : 'save',
  })

  if (next !== current) {
    await supabase.from('quality_inspections').update({ status: next }).eq('id', inspectionId)
  }
  return next
}

export async function fetchProjectStaffOptionsAction(projectId: string): Promise<
  QualityActionResult<Array<{ id: string; full_name: string }>>
> {
  const session = await getSession()
  if (!session.ok) return session
  const access = await assertProjectStaff(
    session.supabase,
    session.userId,
    session.role,
    projectId,
  )
  if (!access.ok) return access

  const { data: project } = await session.supabase
    .from('projects')
    .select('pm_id')
    .eq('id', projectId)
    .maybeSingle()
  const { data: engineers } = await session.supabase
    .from('project_engineers')
    .select('engineer_id')
    .eq('project_id', projectId)

  const ids = new Set<string>()
  if (project?.pm_id) ids.add(project.pm_id)
  for (const row of engineers ?? []) ids.add(row.engineer_id)
  ids.add(session.userId)
  if (ids.size === 0) return { ok: true, data: [] }

  const { data: profiles, error } = await session.supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', [...ids])
  if (error) return fail(error)
  return { ok: true, data: (profiles ?? []) as Array<{ id: string; full_name: string }> }
}
