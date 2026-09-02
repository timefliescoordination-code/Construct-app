'use server'

import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { COMPANY_SETTINGS_ID } from '@/lib/company/constants'
import { DEFAULT_PROPOSAL_NOTES } from '@/lib/proposals/constants'
import {
  computeProposalLines,
  computeProposalTotals,
  validateProposalForShare,
} from '@/lib/proposals/calculations'
import {
  canCreateRevisionFromStatus,
  canEditProposalVersion,
  canShareProposalVersion,
} from '@/lib/proposals/access'
import { recordProposalAudit } from '@/lib/proposals/notifications'
import { createProjectAction } from '@/lib/projects/actions'
import type { ProposalEditorPayload } from '@/lib/proposals/types'
import type { ProposalItemSection, ProposalMethod } from '@/lib/proposals/constants'
import type { UserRole } from '@/lib/types/database'
import { measurementsFromUnknown, measurementsToJson } from '@/lib/proposals/boq-structure'

export type ProposalActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

type SessionOk = {
  ok: true
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  role: 'admin' | 'pm'
}

async function getManageSession(): Promise<SessionOk | { ok: false; error: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'You must be signed in.' }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }

  const role = profile?.role as UserRole | undefined
  if (role !== 'admin' && role !== 'pm') {
    return { ok: false, error: 'Only admins and project managers can manage proposals.' }
  }

  return { ok: true, supabase, userId: user.id, role }
}

async function assertProjectAccess(
  session: SessionOk,
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.role === 'admin') return { ok: true }

  const { data: project, error } = await session.supabase
    .from('projects')
    .select('pm_id')
    .eq('id', projectId)
    .maybeSingle()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  if (!project) return { ok: false, error: 'Project not found.' }
  if (project.pm_id !== session.userId) {
    return { ok: false, error: 'You can only manage proposals for projects assigned to you.' }
  }
  return { ok: true }
}

async function assertProposalRecordAccess(
  session: SessionOk,
  proposal: { project_id: string | null; created_by: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (session.role === 'admin') return { ok: true }
  if (proposal.project_id) return assertProjectAccess(session, proposal.project_id)
  if (proposal.created_by === session.userId) return { ok: true }
  return {
    ok: false,
    error: 'You can only manage proposals you created until they are moved to the project list.',
  }
}

function revalidateProposalPaths(projectId: string | null | undefined, proposalId?: string) {
  revalidatePath('/proposals')
  if (projectId) revalidatePath(`/projects/${projectId}`)
  if (proposalId) {
    revalidatePath(`/proposals/${proposalId}`)
    revalidatePath(`/proposals/${proposalId}/edit`)
  }
  revalidatePath('/admin')
  revalidatePath('/pm')
}

function generatePublicToken() {
  return randomBytes(32).toString('hex')
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

type ProposedProjectSnapshot = {
  name: string
  client_name: string
  site_address: string
  client_phone: string | null
  client_email: string | null
}

function snapshotFromProposed(
  payload: ProposalEditorPayload,
): { ok: true; snapshot: ProposedProjectSnapshot } | { ok: false; error: string } {
  const name = payload.proposedProjectName.trim()
  const siteAddress = payload.proposedSiteAddress.trim()
  if (!name) {
    return { ok: false, error: 'Proposed project name is required.' }
  }
  return {
    ok: true,
    snapshot: {
      name,
      client_name: payload.proposedClientName.trim(),
      site_address: siteAddress,
      client_phone: payload.proposedClientPhone.trim() || null,
      client_email: payload.proposedClientEmail.trim() || null,
    },
  }
}

async function loadDefaultNotes(supabase: SessionOk['supabase']): Promise<string> {
  const { data } = await supabase
    .from('company_settings')
    .select('proposal_default_notes')
    .eq('id', COMPANY_SETTINGS_ID)
    .maybeSingle()

  const notes = data?.proposal_default_notes?.trim()
  return notes || DEFAULT_PROPOSAL_NOTES
}

function preparedLines(payload: ProposalEditorPayload) {
  const raw = payload.items
    .map((item, index) => ({
      section: item.section,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      sortOrder: index,
      kind: item.kind,
      measurements: item.measurements ?? null,
      nested: Boolean(item.nested),
    }))
    .filter((item) => item.description.trim())

  return computeProposalLines(raw)
}

async function replaceVersionItems(
  supabase: SessionOk['supabase'],
  versionId: string,
  lines: ReturnType<typeof preparedLines>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error: deleteError } = await supabase
    .from('proposal_items')
    .delete()
    .eq('proposal_version_id', versionId)

  if (deleteError) return { ok: false, error: getSupabaseErrorMessage(deleteError) }

  if (lines.length === 0) return { ok: true }

    const { error: insertError } = await supabase.from('proposal_items').insert(
    lines.map((line) => ({
      proposal_version_id: versionId,
      section: line.section,
      sort_order: line.sortOrder,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rate,
      price: line.price,
      kind: line.kind,
      measurements: measurementsToJson(line.measurements),
      nested: line.nested,
    })),
  )

  if (insertError) return { ok: false, error: getSupabaseErrorMessage(insertError) }
  return { ok: true }
}

export async function getProposalDefaultNotesAction(): Promise<ProposalActionResult<{ notes: string }>> {
  const session = await getManageSession()
  if (!session.ok) return session
  const notes = await loadDefaultNotes(session.supabase)
  return { ok: true, data: { notes } }
}

export async function createProposalAction(
  payload: ProposalEditorPayload,
): Promise<ProposalActionResult<{ id: string; proposalNumber: string }>> {
  const session = await getManageSession()
  if (!session.ok) return session

  const snapshot = snapshotFromProposed(payload)
  if (!snapshot.ok) return snapshot

  if (!payload.title.trim()) {
    return { ok: false, error: 'Proposal title is required.' }
  }
  if (payload.method !== 'sqft' && payload.method !== 'boq') {
    return { ok: false, error: 'Choose Sqft or BOQ pricing.' }
  }

  const lines = preparedLines(payload)
  const totals = computeProposalTotals(payload.method, lines)
  const notes = payload.notes.trim() || (await loadDefaultNotes(session.supabase))

  const { data: proposalNumber, error: numberError } = await session.supabase.rpc(
    'next_proposal_number',
  )
  if (numberError || !proposalNumber) {
    return {
      ok: false,
      error: numberError ? getSupabaseErrorMessage(numberError) : 'Could not generate a proposal number.',
    }
  }

  const { data: proposal, error: proposalError } = await session.supabase
    .from('proposals')
    .insert({
      project_id: null,
      proposed_project_name: snapshot.snapshot.name,
      proposed_site_address: snapshot.snapshot.site_address,
      proposed_client_name: snapshot.snapshot.client_name,
      proposed_client_phone: snapshot.snapshot.client_phone,
      proposed_client_email: snapshot.snapshot.client_email,
      proposal_number: proposalNumber,
      title: payload.title.trim(),
      status: 'draft',
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (proposalError || !proposal) {
    return { ok: false, error: proposalError ? getSupabaseErrorMessage(proposalError) : 'Could not create proposal.' }
  }

  const { data: version, error: versionError } = await session.supabase
    .from('proposal_versions')
    .insert({
      proposal_id: proposal.id,
      version_number: 1,
      method: payload.method,
      status: 'draft',
      title: payload.title.trim(),
      proposal_date: payload.proposalDate || todayIsoDate(),
      valid_until: payload.validUntil || null,
      notes,
      built_up_total: totals.builtUpTotal,
      additional_works_total: totals.additionalWorksTotal,
      grand_total: totals.grandTotal,
      snapshot_project_name: snapshot.snapshot.name,
      snapshot_client_name: snapshot.snapshot.client_name,
      snapshot_project_address: snapshot.snapshot.site_address,
      snapshot_client_phone: snapshot.snapshot.client_phone,
      snapshot_client_email: snapshot.snapshot.client_email,
      created_by: session.userId,
    })
    .select('id')
    .single()

  if (versionError || !version) {
    await session.supabase.from('proposals').delete().eq('id', proposal.id)
    return { ok: false, error: versionError ? getSupabaseErrorMessage(versionError) : 'Could not create proposal version.' }
  }

  const itemsResult = await replaceVersionItems(session.supabase, version.id, lines)
  if (!itemsResult.ok) {
    await session.supabase.from('proposals').delete().eq('id', proposal.id)
    return itemsResult
  }

  const { error: linkError } = await session.supabase
    .from('proposals')
    .update({ current_version_id: version.id })
    .eq('id', proposal.id)

  if (linkError) {
    return { ok: false, error: getSupabaseErrorMessage(linkError) }
  }

  await recordProposalAudit(session.supabase, {
    proposalId: proposal.id,
    proposalVersionId: version.id,
    eventType: 'created',
    actorId: session.userId,
    actorRole: session.role,
  })

  revalidateProposalPaths(null, proposal.id)
  return { ok: true, data: { id: proposal.id, proposalNumber: String(proposalNumber) } }
}

export async function updateDraftProposalAction(
  proposalId: string,
  payload: ProposalEditorPayload,
): Promise<ProposalActionResult<{ id: string }>> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error: loadError } = await session.supabase
    .from('proposals')
    .select('id, project_id, created_by, current_version_id, status')
    .eq('id', proposalId)
    .maybeSingle()

  if (loadError) return { ok: false, error: getSupabaseErrorMessage(loadError) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access

  if (!proposal.current_version_id) {
    return { ok: false, error: 'This proposal has no current version to edit.' }
  }

  const { data: version, error: versionError } = await session.supabase
    .from('proposal_versions')
    .select('*')
    .eq('id', proposal.current_version_id)
    .maybeSingle()

  if (versionError) return { ok: false, error: getSupabaseErrorMessage(versionError) }
  if (!version) return { ok: false, error: 'Proposal version not found.' }
  if (!canEditProposalVersion(version.status, version.shared_at)) {
    return { ok: false, error: 'Shared proposal versions cannot be edited. Create a revision instead.' }
  }
  if (version.method !== payload.method) {
    // Allowed only while still a draft that has never been shared.
    if (version.shared_at) {
      return { ok: false, error: 'Pricing method cannot be changed after a version is shared.' }
    }
  }

  const snapshot = snapshotFromProposed(payload)
  if (!snapshot.ok) return snapshot

  const lines = preparedLines(payload)
  const totals = computeProposalTotals(payload.method, lines)
  const notes = payload.notes.trim() || version.notes

  const { error: updateVersionError } = await session.supabase
    .from('proposal_versions')
    .update({
      method: payload.method,
      title: payload.title.trim() || version.title,
      proposal_date: payload.proposalDate || version.proposal_date,
      valid_until: payload.validUntil || null,
      notes,
      built_up_total: totals.builtUpTotal,
      additional_works_total: totals.additionalWorksTotal,
      grand_total: totals.grandTotal,
      snapshot_project_name: snapshot.snapshot.name,
      snapshot_client_name: snapshot.snapshot.client_name,
      snapshot_project_address: snapshot.snapshot.site_address,
      snapshot_client_phone: snapshot.snapshot.client_phone,
      snapshot_client_email: snapshot.snapshot.client_email,
    })
    .eq('id', version.id)

  if (updateVersionError) return { ok: false, error: getSupabaseErrorMessage(updateVersionError) }

  const itemsResult = await replaceVersionItems(session.supabase, version.id, lines)
  if (!itemsResult.ok) return itemsResult

  const { error: updateProposalError } = await session.supabase
    .from('proposals')
    .update({
      title: payload.title.trim(),
      proposed_project_name: snapshot.snapshot.name,
      proposed_site_address: snapshot.snapshot.site_address,
      proposed_client_name: snapshot.snapshot.client_name,
      proposed_client_phone: snapshot.snapshot.client_phone,
      proposed_client_email: snapshot.snapshot.client_email,
    })
    .eq('id', proposalId)

  if (updateProposalError) return { ok: false, error: getSupabaseErrorMessage(updateProposalError) }

  await recordProposalAudit(session.supabase, {
    proposalId,
    proposalVersionId: version.id,
    eventType: 'edited',
    actorId: session.userId,
    actorRole: session.role,
  })

  revalidateProposalPaths(proposal.project_id, proposalId)
  return { ok: true, data: { id: proposalId } }
}

export async function shareProposalAction(
  proposalId: string,
): Promise<ProposalActionResult<{ shareUrlPath: string; token: string }>> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error: loadError } = await session.supabase
    .from('proposals')
    .select('id, project_id, created_by, current_version_id, status, share_token, proposal_number, title')
    .eq('id', proposalId)
    .maybeSingle()

  if (loadError) return { ok: false, error: getSupabaseErrorMessage(loadError) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }
  if (proposal.status === 'withdrawn' || proposal.status === 'archived') {
    return { ok: false, error: 'This proposal is no longer active.' }
  }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access
  if (!proposal.current_version_id) {
    return { ok: false, error: 'This proposal has no current version to share.' }
  }

  const { data: version, error: versionError } = await session.supabase
    .from('proposal_versions')
    .select('*')
    .eq('id', proposal.current_version_id)
    .maybeSingle()

  if (versionError) return { ok: false, error: getSupabaseErrorMessage(versionError) }
  if (!version) return { ok: false, error: 'Proposal version not found.' }

  const { data: items } = await session.supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_version_id', version.id)
    .order('sort_order', { ascending: true })

  const shareError = validateProposalForShare({
    projectName: version.snapshot_project_name,
    projectAddress: version.snapshot_project_address,
    method: version.method as ProposalMethod,
    items: (items ?? []).map((item) => ({
      section: item.section as ProposalItemSection,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      kind: item.kind,
      measurements: measurementsFromUnknown(item.measurements),
      nested: Boolean(item.nested),
    })),
  })
  if (shareError) return { ok: false, error: shareError }

  const lines = computeProposalLines(
    (items ?? []).map((item, index) => ({
      section: item.section as ProposalItemSection,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      rate: item.rate,
      sortOrder: index,
      kind: item.kind,
      measurements: measurementsFromUnknown(item.measurements),
      nested: Boolean(item.nested),
    })),
  )
  const totals = computeProposalTotals(version.method as ProposalMethod, lines)

  if (canShareProposalVersion(version.status, version.shared_at)) {
    const versionToken = version.public_token || generatePublicToken()
    const shareToken = proposal.share_token || generatePublicToken()
    const now = new Date().toISOString()

    const { error: totalsError } = await session.supabase
      .from('proposal_versions')
      .update({
        built_up_total: totals.builtUpTotal,
        additional_works_total: totals.additionalWorksTotal,
        grand_total: totals.grandTotal,
      })
      .eq('id', version.id)

    if (totalsError) return { ok: false, error: getSupabaseErrorMessage(totalsError) }

    const { error: shareVersionError } = await session.supabase
      .from('proposal_versions')
      .update({
        status: 'shared',
        public_token: versionToken,
        shared_at: now,
      })
      .eq('id', version.id)

    if (shareVersionError) return { ok: false, error: getSupabaseErrorMessage(shareVersionError) }

    if (version.version_number > 1) {
      await session.supabase
        .from('proposal_versions')
        .update({ status: 'superseded' })
        .eq('proposal_id', proposalId)
        .lt('version_number', version.version_number)
        .not('shared_at', 'is', null)
    }

    const { error: shareProposalError } = await session.supabase
      .from('proposals')
      .update({
        status: 'shared',
        share_token: shareToken,
      })
      .eq('id', proposalId)

    if (shareProposalError) return { ok: false, error: getSupabaseErrorMessage(shareProposalError) }

    await recordProposalAudit(session.supabase, {
      proposalId,
      proposalVersionId: version.id,
      eventType: version.version_number > 1 ? 'revision_shared' : 'shared',
      actorId: session.userId,
      actorRole: session.role,
      metadata: { version_number: version.version_number },
    })

    revalidateProposalPaths(proposal.project_id, proposalId)
    return { ok: true, data: { shareUrlPath: `/proposal/${shareToken}`, token: shareToken } }
  }

  if (proposal.share_token) {
    return {
      ok: true,
      data: { shareUrlPath: `/proposal/${proposal.share_token}`, token: proposal.share_token },
    }
  }

  if (version.public_token) {
    return {
      ok: true,
      data: { shareUrlPath: `/proposal/${version.public_token}`, token: version.public_token },
    }
  }

  return { ok: false, error: 'This version cannot be shared.' }
}

export async function createProposalRevisionAction(
  proposalId: string,
): Promise<ProposalActionResult<{ id: string; versionId: string; versionNumber: number }>> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error: loadError } = await session.supabase
    .from('proposals')
    .select('id, project_id, created_by, current_version_id, status, title')
    .eq('id', proposalId)
    .maybeSingle()

  if (loadError) return { ok: false, error: getSupabaseErrorMessage(loadError) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }
  if (proposal.status === 'withdrawn' || proposal.status === 'archived') {
    return { ok: false, error: 'This proposal is no longer active.' }
  }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access

  const { data: current, error: currentError } = await session.supabase
    .from('proposal_versions')
    .select('*')
    .eq('id', proposal.current_version_id)
    .maybeSingle()

  if (currentError) return { ok: false, error: getSupabaseErrorMessage(currentError) }
  if (!current) return { ok: false, error: 'Current proposal version not found.' }

  if (canEditProposalVersion(current.status, current.shared_at)) {
    return {
      ok: false,
      error: 'The current version is still a draft. Edit it instead of creating another revision.',
    }
  }
  if (!canCreateRevisionFromStatus(current.status, current.shared_at)) {
    return { ok: false, error: 'A revision can only be created from a shared proposal version.' }
  }

  const { data: items } = await session.supabase
    .from('proposal_items')
    .select('*')
    .eq('proposal_version_id', current.id)
    .order('sort_order', { ascending: true })

  const nextNumber = Number(current.version_number) + 1

  const { data: revision, error: revisionError } = await session.supabase
    .from('proposal_versions')
    .insert({
      proposal_id: proposalId,
      version_number: nextNumber,
      method: current.method,
      status: 'draft',
      title: current.title,
      proposal_date: todayIsoDate(),
      valid_until: current.valid_until,
      notes: current.notes,
      built_up_total: current.built_up_total,
      additional_works_total: current.additional_works_total,
      grand_total: current.grand_total,
      snapshot_project_name: current.snapshot_project_name,
      snapshot_client_name: current.snapshot_client_name,
      snapshot_project_address: current.snapshot_project_address,
      snapshot_client_phone: current.snapshot_client_phone,
      snapshot_client_email: current.snapshot_client_email,
      created_by: session.userId,
    })
    .select('id, version_number')
    .single()

  if (revisionError || !revision) {
    return {
      ok: false,
      error: revisionError ? getSupabaseErrorMessage(revisionError) : 'Could not create revision.',
    }
  }

  if (items && items.length > 0) {
    const { error: copyError } = await session.supabase.from('proposal_items').insert(
      items.map((item) => ({
        proposal_version_id: revision.id,
        section: item.section,
        sort_order: item.sort_order,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.rate,
        price: item.price,
        kind: item.kind ?? 'item',
        measurements: measurementsFromUnknown(item.measurements),
        nested: Boolean(item.nested),
      })),
    )
    if (copyError) {
      await session.supabase.from('proposal_versions').delete().eq('id', revision.id)
      return { ok: false, error: getSupabaseErrorMessage(copyError) }
    }
  }

  const { error: updateProposalError } = await session.supabase
    .from('proposals')
    .update({
      current_version_id: revision.id,
      status: 'revision_created',
    })
    .eq('id', proposalId)

  if (updateProposalError) return { ok: false, error: getSupabaseErrorMessage(updateProposalError) }

  await session.supabase
    .from('proposal_revision_requests')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: session.userId,
    })
    .eq('proposal_version_id', current.id)
    .eq('status', 'open')

  await recordProposalAudit(session.supabase, {
    proposalId,
    proposalVersionId: revision.id,
    eventType: 'revision_created',
    actorId: session.userId,
    actorRole: session.role,
    metadata: { from_version: current.version_number, to_version: nextNumber },
  })

  revalidateProposalPaths(proposal.project_id, proposalId)
  return {
    ok: true,
    data: { id: proposalId, versionId: revision.id, versionNumber: nextNumber },
  }
}

export async function withdrawProposalAction(
  proposalId: string,
): Promise<ProposalActionResult> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error } = await session.supabase
    .from('proposals')
    .select('id, project_id, created_by, current_version_id, status')
    .eq('id', proposalId)
    .maybeSingle()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access

  const { error: updateError } = await session.supabase
    .from('proposals')
    .update({ status: 'withdrawn' })
    .eq('id', proposalId)

  if (updateError) return { ok: false, error: getSupabaseErrorMessage(updateError) }

  if (proposal.current_version_id) {
    await session.supabase
      .from('proposal_versions')
      .update({ status: 'withdrawn' })
      .eq('id', proposal.current_version_id)
  }

  await recordProposalAudit(session.supabase, {
    proposalId,
    proposalVersionId: proposal.current_version_id,
    eventType: 'withdrawn',
    actorId: session.userId,
    actorRole: session.role,
  })

  revalidateProposalPaths(proposal.project_id, proposalId)
  return { ok: true, data: undefined }
}

export async function archiveProposalAction(
  proposalId: string,
): Promise<ProposalActionResult> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error } = await session.supabase
    .from('proposals')
    .select('id, project_id, created_by, current_version_id')
    .eq('id', proposalId)
    .maybeSingle()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access

  const { error: updateError } = await session.supabase
    .from('proposals')
    .update({
      status: 'archived',
      archived_at: new Date().toISOString(),
    })
    .eq('id', proposalId)

  if (updateError) return { ok: false, error: getSupabaseErrorMessage(updateError) }

  await recordProposalAudit(session.supabase, {
    proposalId,
    proposalVersionId: proposal.current_version_id,
    eventType: 'archived',
    actorId: session.userId,
    actorRole: session.role,
  })

  revalidateProposalPaths(proposal.project_id, proposalId)
  return { ok: true, data: undefined }
}

export async function deleteDraftProposalAction(
  proposalId: string,
): Promise<ProposalActionResult> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error } = await session.supabase
    .from('proposals')
    .select('id, project_id, created_by, status')
    .eq('id', proposalId)
    .maybeSingle()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access

  const { data: sharedVersion } = await session.supabase
    .from('proposal_versions')
    .select('id')
    .eq('proposal_id', proposalId)
    .not('shared_at', 'is', null)
    .limit(1)
    .maybeSingle()

  if (sharedVersion) {
    return { ok: false, error: 'Shared proposals cannot be deleted. Withdraw or archive them instead.' }
  }

  const { error: deleteError } = await session.supabase.from('proposals').delete().eq('id', proposalId)
  if (deleteError) return { ok: false, error: getSupabaseErrorMessage(deleteError) }

  revalidateProposalPaths(proposal.project_id)
  return { ok: true, data: undefined }
}

export async function convertProposalToProjectAction(
  proposalId: string,
): Promise<ProposalActionResult<{ projectId: string }>> {
  const session = await getManageSession()
  if (!session.ok) return session

  const { data: proposal, error } = await session.supabase
    .from('proposals')
    .select(
      'id, project_id, created_by, status, current_version_id, proposed_project_name, proposed_site_address, proposed_client_name, proposed_client_phone, proposed_client_email',
    )
    .eq('id', proposalId)
    .maybeSingle()

  if (error) return { ok: false, error: getSupabaseErrorMessage(error) }
  if (!proposal) return { ok: false, error: 'Proposal not found.' }

  const access = await assertProposalRecordAccess(session, proposal)
  if (!access.ok) return access

  if (proposal.project_id) {
    return { ok: false, error: 'This proposal is already on the project list.' }
  }
  if (proposal.status === 'withdrawn' || proposal.status === 'archived') {
    return { ok: false, error: 'Withdrawn or archived proposals cannot be moved to the project list.' }
  }

  let name = proposal.proposed_project_name?.trim() ?? ''
  let address = proposal.proposed_site_address?.trim() ?? ''
  let clientName = proposal.proposed_client_name?.trim() ?? ''
  let phone = proposal.proposed_client_phone?.trim() || null
  let email = proposal.proposed_client_email?.trim() || null
  let contractValue = 0

  if (proposal.current_version_id) {
    const { data: version } = await session.supabase
      .from('proposal_versions')
      .select(
        'snapshot_project_name, snapshot_project_address, snapshot_client_name, snapshot_client_phone, snapshot_client_email, grand_total',
      )
      .eq('id', proposal.current_version_id)
      .maybeSingle()

    if (version) {
      name = name || version.snapshot_project_name?.trim() || ''
      address = address || version.snapshot_project_address?.trim() || ''
      clientName = clientName || version.snapshot_client_name?.trim() || ''
      phone = phone || version.snapshot_client_phone
      email = email || version.snapshot_client_email
      contractValue = Number(version.grand_total) || 0
    }
  }

  if (!name) {
    return { ok: false, error: 'Add a proposed project name before moving this to the project list.' }
  }
  if (!address) {
    return { ok: false, error: 'Add a project address before moving this to the project list.' }
  }

  const expectedMargin = 15
  const created = await createProjectAction({
    name,
    client_name: clientName,
    site_address: address,
    client_phone: phone,
    contract_value: contractValue,
    additional_works_value: 0,
    expected_margin_percent: expectedMargin,
    start_date: null,
    expected_completion_date: null,
    pm_id: session.role === 'pm' ? session.userId : null,
    customer_id: null,
    stage_budget: contractValue * (1 - expectedMargin / 100),
    assigned_engineer_ids: [],
  })

  if (!created.ok) return created

  const { error: linkError } = await session.supabase
    .from('proposals')
    .update({
      project_id: created.projectId,
      proposed_project_name: name,
      proposed_site_address: address,
      proposed_client_name: clientName,
      proposed_client_phone: phone,
      proposed_client_email: email,
      converted_at: new Date().toISOString(),
      converted_by: session.userId,
    })
    .eq('id', proposalId)

  if (linkError) {
    return {
      ok: false,
      error: `The project was created, but this proposal could not be linked. Open the project list and check for “${name}”. ${getSupabaseErrorMessage(linkError)}`,
    }
  }

  await recordProposalAudit(session.supabase, {
    proposalId,
    proposalVersionId: proposal.current_version_id,
    eventType: 'converted_to_project',
    actorId: session.userId,
    actorRole: session.role,
    metadata: { project_id: created.projectId },
  })

  revalidateProposalPaths(created.projectId, proposalId)
  return { ok: true, data: { projectId: created.projectId } }
}
