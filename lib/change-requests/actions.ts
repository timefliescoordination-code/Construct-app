'use server'

import { revalidatePath } from 'next/cache'
import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  CHANGE_REQUEST_ALLOWED_MIME,
  CHANGE_REQUEST_ATTACHMENT_MAX_BYTES,
  type ChangeRequestCategory,
} from '@/lib/change-requests/constants'
import { sumCostingRows } from '@/lib/change-requests/calculations'
import {
  notifyCustomerOnChangeRequestStatus,
  notifyStaffOnChangeRequestSubmitted,
} from '@/lib/change-requests/notifications'
import { uploadChangeRequestFile, deleteChangeRequestFile } from '@/lib/change-requests/storage'
import {
  canCustomerCancel,
  canCustomerEdit,
  canAdminOverride,
  canPmApprove,
} from '@/lib/change-requests/workflow'
import { CHANGE_REQUEST_STATUS_LABELS } from '@/lib/change-requests/constants'
import type {
  ChangeRequestStatus,
  ConstructionChangeCostingRow,
  UserRole,
} from '@/lib/types/database'

export type ChangeRequestActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

type CostingRowInput = { description: string; unit: string; price: number }

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

  return {
    ok: true as const,
    supabase,
    userId: user.id,
    role,
    fullName: profile?.full_name ?? '',
  }
}

function revalidateChangeRequestPaths(projectId: string, requestId?: string) {
  revalidatePath('/customer')
  revalidatePath('/change-requests')
  if (requestId) revalidatePath(`/change-requests/${requestId}`)
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/admin')
  revalidatePath('/pm')
  revalidatePath('/engineer')
  revalidatePath('/api/projects/default')
  revalidatePath(`/api/projects/${projectId}`)
}

async function recordAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    changeRequestId: string
    eventType: string
    fromStatus?: string | null
    toStatus?: string | null
    actorId: string
    actorRole: string
    comments?: string | null
    metadata?: Record<string, unknown> | null
  },
) {
  await supabase.from('construction_change_audit_events').insert({
    change_request_id: input.changeRequestId,
    event_type: input.eventType,
    from_status: input.fromStatus ?? null,
    to_status: input.toStatus ?? null,
    actor_id: input.actorId,
    actor_role: input.actorRole,
    comments: input.comments ?? null,
    metadata: input.metadata ?? null,
  })
}

async function transitionStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: {
    requestId: string
    projectId: string
    fromStatus: ChangeRequestStatus
    toStatus: ChangeRequestStatus
    actorId: string
    actorRole: string
    comments?: string
    extraUpdates?: Record<string, unknown>
  },
) {
  const updates: Record<string, unknown> = {
    status: input.toStatus,
    ...input.extraUpdates,
  }

  if (input.toStatus === 'submitted') {
    updates.submitted_at = new Date().toISOString()
  }
  if (input.toStatus === 'cancelled') {
    updates.cancelled_at = new Date().toISOString()
    updates.cancelled_by = input.actorId
  }

  const { data, error } = await supabase
    .from('construction_change_requests')
    .update(updates)
    .eq('id', input.requestId)
    .select('*')
    .single()

  if (error) return { ok: false as const, error: getSupabaseErrorMessage(error) }

  await recordAudit(supabase, {
    changeRequestId: input.requestId,
    eventType: 'status_change',
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorId: input.actorId,
    actorRole: input.actorRole,
    comments: input.comments,
  })

  revalidateChangeRequestPaths(input.projectId, input.requestId)
  return { ok: true as const, data }
}

export async function createChangeRequestAction(input: {
  projectId: string
  title: string
  description: string
  category: ChangeRequestCategory
  relatedMilestoneId?: string | null
  preferredCompletionDate?: string | null
  submit?: boolean
}): Promise<ChangeRequestActionResult<{ id: string; request_number: string; status: string }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'customer') {
    return { ok: false, error: 'Only customers can create change requests.' }
  }

  const { data: project } = await session.supabase
    .from('projects')
    .select('id, name, customer_id')
    .eq('id', input.projectId)
    .maybeSingle()

  if (!project || project.customer_id !== session.userId) {
    return { ok: false, error: 'You can only request changes on your assigned project.' }
  }

  const { data: requestNumber, error: numError } = await session.supabase.rpc(
    'next_change_request_number',
    { p_project_id: input.projectId },
  )

  if (numError || !requestNumber) {
    return { ok: false, error: numError ? getSupabaseErrorMessage(numError) : 'Failed to generate request number.' }
  }

  const status: ChangeRequestStatus = input.submit ? 'submitted' : 'draft'

  const { data, error } = await session.supabase
    .from('construction_change_requests')
    .insert({
      project_id: input.projectId,
      customer_id: session.userId,
      request_number: requestNumber,
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      related_milestone_id: input.relatedMilestoneId || null,
      preferred_completion_date: input.preferredCompletionDate || null,
      status,
      submitted_at: input.submit ? new Date().toISOString() : null,
    })
    .select('id, request_number, status, title')
    .single()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  await recordAudit(session.supabase, {
    changeRequestId: data.id,
    eventType: 'status_change',
    toStatus: status,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.submit ? 'Submitted by customer' : 'Draft created',
  })

  if (input.submit) {
    await notifyStaffOnChangeRequestSubmitted(session.supabase, {
      projectId: input.projectId,
      projectName: project.name,
      requestId: data.id,
      requestTitle: data.title,
      dedupeKey: `change_request_submitted:${data.id}`,
    })
    await notifyCustomerOnChangeRequestStatus(session.supabase, {
      projectId: input.projectId,
      requestId: data.id,
      title: data.title,
      statusLabel: CHANGE_REQUEST_STATUS_LABELS.submitted,
      dedupeKey: `change_request_customer:submitted:${data.id}`,
    })
  }

  revalidateChangeRequestPaths(input.projectId, data.id)
  return { ok: true, data: { id: data.id, request_number: data.request_number, status: data.status } }
}

export async function updateChangeRequestAction(input: {
  requestId: string
  projectId: string
  title: string
  description: string
  category: ChangeRequestCategory
  relatedMilestoneId?: string | null
  preferredCompletionDate?: string | null
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, customer_id')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Change request not found.' }

  if (session.role === 'customer') {
    if (existing.customer_id !== session.userId) {
      return { ok: false, error: 'You can only edit your own requests.' }
    }
    if (!canCustomerEdit(existing.status as ChangeRequestStatus)) {
      return { ok: false, error: 'This request can no longer be edited.' }
    }
  } else if (session.role !== 'admin' && session.role !== 'pm') {
    return { ok: false, error: 'You do not have permission to edit this request.' }
  }

  const { error } = await session.supabase
    .from('construction_change_requests')
    .update({
      title: input.title.trim(),
      description: input.description.trim(),
      category: input.category,
      related_milestone_id: input.relatedMilestoneId || null,
      preferred_completion_date: input.preferredCompletionDate || null,
    })
    .eq('id', input.requestId)

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  revalidateChangeRequestPaths(input.projectId, input.requestId)
  return { ok: true, data: undefined }
}

export async function submitChangeRequestAction(input: {
  requestId: string
  projectId: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'customer') {
    return { ok: false, error: 'Only customers can submit change requests.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, customer_id, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing || existing.customer_id !== session.userId) {
    return { ok: false, error: 'Change request not found.' }
  }
  if (existing.status !== 'draft') {
    return { ok: false, error: 'Only draft requests can be submitted.' }
  }

  const { data: project } = await session.supabase
    .from('projects')
    .select('name')
    .eq('id', input.projectId)
    .maybeSingle()

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: 'draft',
    toStatus: 'submitted',
    actorId: session.userId,
    actorRole: session.role,
    comments: 'Submitted by customer',
  })

  if (!result.ok) return result

  await notifyStaffOnChangeRequestSubmitted(session.supabase, {
    projectId: input.projectId,
    projectName: project?.name ?? 'Project',
    requestId: input.requestId,
    requestTitle: existing.title,
    dedupeKey: `change_request_submitted:${input.requestId}`,
  })

  await notifyCustomerOnChangeRequestStatus(session.supabase, {
    projectId: input.projectId,
    requestId: input.requestId,
    title: existing.title,
    statusLabel: CHANGE_REQUEST_STATUS_LABELS.submitted,
    dedupeKey: `change_request_customer:submitted:${input.requestId}`,
  })

  return { ok: true, data: undefined }
}

export async function cancelChangeRequestAction(input: {
  requestId: string
  projectId: string
  reason?: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, customer_id, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Change request not found.' }

  const isCustomerOwner =
    session.role === 'customer' && existing.customer_id === session.userId
  const isStaff = session.role === 'admin' || session.role === 'pm'

  if (!isCustomerOwner && !isStaff) {
    return { ok: false, error: 'You do not have permission to cancel this request.' }
  }
  if (isCustomerOwner && !canCustomerCancel(existing.status as ChangeRequestStatus)) {
    return { ok: false, error: 'This request can no longer be cancelled.' }
  }

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: existing.status as ChangeRequestStatus,
    toStatus: 'cancelled',
    actorId: session.userId,
    actorRole: session.role,
    comments: input.reason ?? 'Cancelled',
  })

  if (!result.ok) return result

  if (isCustomerOwner) {
    await notifyCustomerOnChangeRequestStatus(session.supabase, {
      projectId: input.projectId,
      requestId: input.requestId,
      title: existing.title,
      statusLabel: CHANGE_REQUEST_STATUS_LABELS.cancelled,
      dedupeKey: `change_request_customer:cancelled:${input.requestId}`,
    })
  }

  return { ok: true, data: undefined }
}

export async function uploadChangeRequestAttachmentAction(
  formData: FormData,
): Promise<ChangeRequestActionResult<{ id: string }>> {
  const session = await getSession()
  if (!session.ok) return session

  const requestId = String(formData.get('requestId') ?? '')
  const projectId = String(formData.get('projectId') ?? '')
  const visibility = (String(formData.get('visibility') ?? 'customer') === 'internal'
    ? 'internal'
    : 'customer') as 'customer' | 'internal'
  const file = formData.get('file')

  if (!requestId || !projectId || !(file instanceof File)) {
    return { ok: false, error: 'Request, project, and file are required.' }
  }

  if (file.size > CHANGE_REQUEST_ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: 'File exceeds maximum size (20 MB).' }
  }
  if (!CHANGE_REQUEST_ALLOWED_MIME.includes(file.type as typeof CHANGE_REQUEST_ALLOWED_MIME[number])) {
    return { ok: false, error: 'File type is not allowed.' }
  }

  if (session.role === 'customer' && visibility !== 'customer') {
    return { ok: false, error: 'Customers can only upload customer-visible attachments.' }
  }

  const attachmentId = randomUUID()
  const buffer = Buffer.from(await file.arrayBuffer())
  const upload = await uploadChangeRequestFile(session.supabase, {
    changeRequestId: requestId,
    attachmentId,
    fileName: file.name,
    mimeType: file.type,
    fileBuffer: buffer,
  })

  if ('error' in upload) return { ok: false, error: upload.error }

  const { data, error } = await session.supabase
    .from('construction_change_request_attachments')
    .insert({
      id: attachmentId,
      change_request_id: requestId,
      uploaded_by: session.userId,
      file_path: upload.filePath,
      file_name: file.name,
      file_mime_type: file.type,
      visibility,
    })
    .select('id')
    .single()

  if (error) {
    await deleteChangeRequestFile(session.supabase, upload.filePath)
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidateChangeRequestPaths(projectId, requestId)
  return { ok: true, data: { id: data.id } }
}

export async function saveCostingRevisionAction(input: {
  requestId: string
  projectId: string
  rows: CostingRowInput[]
  estimatedAdditionalDays?: number | null
  affectedMilestoneId?: string | null
  internalNotes?: string | null
  customerVisibleExplanation?: string | null
  reasonForChange?: string | null
  moveToCostingPrepared?: boolean
}): Promise<ChangeRequestActionResult<{ revisionId: string; totalPrice: number }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'admin' && session.role !== 'pm' && session.role !== 'engineer') {
    return { ok: false, error: 'Only project staff can prepare costing.' }
  }

  if (!input.rows.length) {
    return { ok: false, error: 'Add at least one costing row.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Change request not found.' }

  const allowedStatuses: ChangeRequestStatus[] = [
    'submitted',
    'under_review',
    'costing_prepared',
    'internal_approval_pending',
    'customer_approval_pending',
  ]
  if (!allowedStatuses.includes(existing.status as ChangeRequestStatus)) {
    return { ok: false, error: 'Costing cannot be edited in the current status.' }
  }

  const { count } = await session.supabase
    .from('construction_change_costing_revisions')
    .select('id', { count: 'exact', head: true })
    .eq('change_request_id', input.requestId)

  const revisionNumber = (count ?? 0) + 1
  const totalPrice = sumCostingRows(input.rows)

  const { data: revision, error: revError } = await session.supabase
    .from('construction_change_costing_revisions')
    .insert({
      change_request_id: input.requestId,
      revision_number: revisionNumber,
      author_id: session.userId,
      reason_for_change: input.reasonForChange?.trim() || null,
      estimated_additional_days: input.estimatedAdditionalDays ?? null,
      affected_milestone_id: input.affectedMilestoneId || null,
      internal_notes: input.internalNotes?.trim() || null,
      customer_visible_explanation: input.customerVisibleExplanation?.trim() || null,
      total_price: totalPrice,
    })
    .select('id')
    .single()

  if (revError) return { ok: false, error: getSupabaseErrorMessage(revError) }

  const rowInserts = input.rows.map((row, index) => ({
    revision_id: revision.id,
    line_order: index,
    description: row.description.trim(),
    unit: row.unit.trim(),
    price: Number(row.price),
  }))

  const { error: rowsError } = await session.supabase
    .from('construction_change_costing_rows')
    .insert(rowInserts)

  if (rowsError) return { ok: false, error: getSupabaseErrorMessage(rowsError) }

  const nextStatus: ChangeRequestStatus = input.moveToCostingPrepared
    ? 'costing_prepared'
    : (existing.status as ChangeRequestStatus)

  const { error: updateError } = await session.supabase
    .from('construction_change_requests')
    .update({
      active_costing_revision_id: revision.id,
      estimated_additional_days: input.estimatedAdditionalDays ?? null,
      affected_milestone_id: input.affectedMilestoneId || null,
      internal_notes: input.internalNotes?.trim() || null,
      customer_visible_explanation: input.customerVisibleExplanation?.trim() || null,
      status: nextStatus,
      assigned_reviewer_id: session.userId,
    })
    .eq('id', input.requestId)

  if (updateError) return { ok: false, error: getSupabaseErrorMessage(updateError) }

  await recordAudit(session.supabase, {
    changeRequestId: input.requestId,
    eventType: 'costing_revision',
    fromStatus: existing.status,
    toStatus: nextStatus,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.reasonForChange ?? `Revision ${revisionNumber}`,
    metadata: { revisionId: revision.id, totalPrice },
  })

  revalidateChangeRequestPaths(input.projectId, input.requestId)
  return { ok: true, data: { revisionId: revision.id, totalPrice } }
}

export async function startChangeRequestReviewAction(input: {
  requestId: string
  projectId: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role === 'customer') {
    return { ok: false, error: 'Customers cannot start internal review.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing || existing.status !== 'submitted') {
    return { ok: false, error: 'Only submitted requests can move to under review.' }
  }

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: 'submitted',
    toStatus: 'under_review',
    actorId: session.userId,
    actorRole: session.role,
    extraUpdates: { assigned_reviewer_id: session.userId },
  })

  if (!result.ok) return result

  await notifyCustomerOnChangeRequestStatus(session.supabase, {
    projectId: input.projectId,
    requestId: input.requestId,
    title: existing.title,
    statusLabel: CHANGE_REQUEST_STATUS_LABELS.under_review,
    dedupeKey: `change_request_customer:under_review:${input.requestId}`,
  })

  return { ok: true, data: undefined }
}

export async function submitChangeRequestForInternalApprovalAction(input: {
  requestId: string
  projectId: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPmApprove(session.role) && session.role !== 'engineer') {
    return { ok: false, error: 'Only project staff can submit for internal approval.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, active_costing_revision_id')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing?.active_costing_revision_id) {
    return { ok: false, error: 'Prepare costing before internal approval.' }
  }

  return transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: existing.status as ChangeRequestStatus,
    toStatus: 'internal_approval_pending',
    actorId: session.userId,
    actorRole: session.role,
    comments: 'Submitted for internal approval',
  })
}

export async function pmApproveChangeRequestAction(input: {
  requestId: string
  projectId: string
  comments?: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPmApprove(session.role)) {
    return { ok: false, error: 'Only PM or Admin can approve internally.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing || existing.status !== 'internal_approval_pending') {
    return { ok: false, error: 'Request is not awaiting internal approval.' }
  }

  await recordAudit(session.supabase, {
    changeRequestId: input.requestId,
    eventType: 'approval',
    fromStatus: existing.status,
    toStatus: 'customer_approval_pending',
    actorId: session.userId,
    actorRole: session.role,
    comments: input.comments,
  })

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: 'internal_approval_pending',
    toStatus: 'customer_approval_pending',
    actorId: session.userId,
    actorRole: session.role,
    comments: input.comments,
  })

  if (!result.ok) return result

  await notifyCustomerOnChangeRequestStatus(session.supabase, {
    projectId: input.projectId,
    requestId: input.requestId,
    title: existing.title,
    statusLabel: 'Estimate ready for your review',
    dedupeKey: `change_request_customer:customer_approval:${input.requestId}`,
  })

  return { ok: true, data: undefined }
}

export async function pmRejectChangeRequestAction(input: {
  requestId: string
  projectId: string
  comments: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPmApprove(session.role)) {
    return { ok: false, error: 'Only PM or Admin can reject internally.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Change request not found.' }

  await recordAudit(session.supabase, {
    changeRequestId: input.requestId,
    eventType: 'rejection',
    fromStatus: existing.status,
    toStatus: 'rejected',
    actorId: session.userId,
    actorRole: session.role,
    comments: input.comments,
  })

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: existing.status as ChangeRequestStatus,
    toStatus: 'rejected',
    actorId: session.userId,
    actorRole: session.role,
    comments: input.comments,
  })

  if (!result.ok) return result

  await notifyCustomerOnChangeRequestStatus(session.supabase, {
    projectId: input.projectId,
    requestId: input.requestId,
    title: existing.title,
    statusLabel: CHANGE_REQUEST_STATUS_LABELS.rejected,
    dedupeKey: `change_request_customer:rejected:${input.requestId}`,
  })

  return { ok: true, data: undefined }
}

export async function adminOverrideChangeRequestAction(input: {
  requestId: string
  projectId: string
  toStatus: ChangeRequestStatus
  reason: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canAdminOverride(session.role)) {
    return { ok: false, error: 'Only Company Admin can override decisions.' }
  }
  if (!input.reason.trim()) {
    return { ok: false, error: 'Override reason is required.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Change request not found.' }

  await recordAudit(session.supabase, {
    changeRequestId: input.requestId,
    eventType: 'override',
    fromStatus: existing.status,
    toStatus: input.toStatus,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.reason,
  })

  return transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: existing.status as ChangeRequestStatus,
    toStatus: input.toStatus,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.reason,
  })
}

export async function customerDecisionOnChangeRequestAction(input: {
  requestId: string
  projectId: string
  decision: 'accepted' | 'rejected'
  confirmationText: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'customer') {
    return { ok: false, error: 'Only customers can accept or reject estimates.' }
  }
  if (!input.confirmationText.trim()) {
    return { ok: false, error: 'Confirmation text is required.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, customer_id, title, active_costing_revision_id')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing || existing.customer_id !== session.userId) {
    return { ok: false, error: 'Change request not found.' }
  }
  if (existing.status !== 'customer_approval_pending' || !existing.active_costing_revision_id) {
    return { ok: false, error: 'This request is not awaiting your approval.' }
  }

  const { error: decisionError } = await session.supabase
    .from('construction_change_customer_decisions')
    .insert({
      change_request_id: input.requestId,
      revision_id: existing.active_costing_revision_id,
      decision: input.decision,
      confirmation_text: input.confirmationText.trim(),
      user_id: session.userId,
    })

  if (decisionError) return { ok: false, error: getSupabaseErrorMessage(decisionError) }

  const nextStatus: ChangeRequestStatus =
    input.decision === 'accepted' ? 'approved' : 'rejected'

  await recordAudit(session.supabase, {
    changeRequestId: input.requestId,
    eventType: input.decision === 'accepted' ? 'customer_accept' : 'customer_reject',
    fromStatus: existing.status,
    toStatus: nextStatus,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.confirmationText.trim(),
  })

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: 'customer_approval_pending',
    toStatus: nextStatus,
    actorId: session.userId,
    actorRole: session.role,
    comments: input.confirmationText.trim(),
  })

  if (!result.ok) return result

  if (input.decision === 'accepted') {
    await createAdditionalWorkFromChangeRequest(session.supabase, session.userId, {
      requestId: input.requestId,
      projectId: input.projectId,
    })
  } else {
    await notifyCustomerOnChangeRequestStatus(session.supabase, {
      projectId: input.projectId,
      requestId: input.requestId,
      title: existing.title,
      statusLabel: CHANGE_REQUEST_STATUS_LABELS.rejected,
      dedupeKey: `change_request_customer:customer_rejected:${input.requestId}`,
    })
  }

  return { ok: true, data: undefined }
}

async function createAdditionalWorkFromChangeRequest(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  input: { requestId: string; projectId: string },
) {
  const { data: request } = await supabase
    .from('construction_change_requests')
    .select('title, active_costing_revision_id, additional_work_id')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!request?.active_costing_revision_id || request.additional_work_id) return

  const { data: revision } = await supabase
    .from('construction_change_costing_revisions')
    .select('total_price, customer_visible_explanation')
    .eq('id', request.active_costing_revision_id)
    .maybeSingle()

  if (!revision) return

  const description =
    request.title +
    (revision.customer_visible_explanation
      ? ` — ${revision.customer_visible_explanation}`
      : '')

  const { data: work, error } = await supabase
    .from('additional_works')
    .insert({
      project_id: input.projectId,
      description,
      amount: Number(revision.total_price),
      approval_status: 'approved',
      approved_by: userId,
      approved_date: new Date().toISOString().slice(0, 10),
      notes: `From change request`,
    })
    .select('id')
    .single()

  if (error || !work) return

  await supabase
    .from('construction_change_requests')
    .update({ additional_work_id: work.id })
    .eq('id', input.requestId)
}

export async function scheduleChangeRequestAction(input: {
  requestId: string
  projectId: string
  milestoneId?: string | null
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPmApprove(session.role)) {
    return { ok: false, error: 'Only PM or Admin can schedule changes.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing || existing.status !== 'approved') {
    return { ok: false, error: 'Only approved requests can be scheduled.' }
  }

  return transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: 'approved',
    toStatus: 'scheduled',
    actorId: session.userId,
    actorRole: session.role,
    extraUpdates: { affected_milestone_id: input.milestoneId || null },
  })
}

export async function updateChangeRequestProgressAction(input: {
  requestId: string
  projectId: string
  status: 'in_progress' | 'completed'
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPmApprove(session.role) && session.role !== 'engineer') {
    return { ok: false, error: 'Only project staff can update progress.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing) return { ok: false, error: 'Change request not found.' }

  const allowedFrom: ChangeRequestStatus[] =
    input.status === 'in_progress'
      ? ['scheduled', 'approved']
      : ['in_progress']

  if (!allowedFrom.includes(existing.status as ChangeRequestStatus)) {
    return { ok: false, error: 'Invalid status transition.' }
  }

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: existing.status as ChangeRequestStatus,
    toStatus: input.status,
    actorId: session.userId,
    actorRole: session.role,
  })

  if (!result.ok) return result

  await notifyCustomerOnChangeRequestStatus(session.supabase, {
    projectId: input.projectId,
    requestId: input.requestId,
    title: existing.title,
    statusLabel: CHANGE_REQUEST_STATUS_LABELS[input.status],
    dedupeKey: `change_request_customer:${input.status}:${input.requestId}`,
  })

  return { ok: true, data: undefined }
}

export async function createPaymentRequestForChangeAction(input: {
  requestId: string
  projectId: string
  stageName: string
  amount: number
  dueDate: string
}): Promise<ChangeRequestActionResult<{ paymentId: string }>> {
  const session = await getSession()
  if (!session.ok) return session
  if (!canPmApprove(session.role)) {
    return { ok: false, error: 'Only PM or Admin can create payment requests.' }
  }

  const { data: request } = await supabase
    .from('construction_change_requests')
    .select('status, client_payment_id, active_costing_revision_id')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!request || request.status !== 'approved') {
    return { ok: false, error: 'Payment requests require customer-approved changes.' }
  }
  if (request.client_payment_id) {
    return { ok: false, error: 'A payment request is already linked.' }
  }

  const { data: payment, error } = await session.supabase
    .from('client_payments')
    .insert({
      project_id: input.projectId,
      stage_name: input.stageName.trim(),
      amount: input.amount,
      due_date: input.dueDate,
      status: 'pending',
      entered_by: session.userId,
      notes: `Change request payment`,
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  await session.supabase
    .from('construction_change_requests')
    .update({ client_payment_id: payment.id })
    .eq('id', input.requestId)

  revalidateChangeRequestPaths(input.projectId, input.requestId)
  return { ok: true, data: { paymentId: payment.id } }
}

export async function returnChangeRequestToReviewAction(input: {
  requestId: string
  projectId: string
  comments?: string
}): Promise<ChangeRequestActionResult> {
  const session = await getSession()
  if (!session.ok) return session
  if (session.role !== 'customer') {
    return { ok: false, error: 'Only customers can return requests for revised quotes.' }
  }

  const { data: existing } = await session.supabase
    .from('construction_change_requests')
    .select('status, customer_id, title')
    .eq('id', input.requestId)
    .maybeSingle()

  if (!existing || existing.customer_id !== session.userId) {
    return { ok: false, error: 'Change request not found.' }
  }
  if (existing.status !== 'customer_approval_pending') {
    return { ok: false, error: 'Only pending estimates can be returned for review.' }
  }

  const result = await transitionStatus(session.supabase, {
    requestId: input.requestId,
    projectId: input.projectId,
    fromStatus: 'customer_approval_pending',
    toStatus: 'under_review',
    actorId: session.userId,
    actorRole: session.role,
    comments: input.comments ?? 'Customer requested revised quote',
  })

  return result.ok ? { ok: true, data: undefined } : result
}
