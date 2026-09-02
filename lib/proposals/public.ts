import { createAdminClient } from '@/lib/supabase/server'
import { getCompanyLogoPublicUrl } from '@/lib/company/storage'
import { COMPANY_SETTINGS_ID } from '@/lib/company/constants'
import {
  MAX_CLIENT_MESSAGE_LENGTH,
  MAX_REVISION_REQUESTS_PER_HOUR,
  formatProposalNumber,
  type ProposalMethod,
} from '@/lib/proposals/constants'
import { recordProposalAudit, notifyStaffOnProposalRevision } from '@/lib/proposals/notifications'
import type {
  PublicProposalAvailability,
  PublicProposalDocument,
  PublicProposalItem,
  PublicProposalResponse,
} from '@/lib/proposals/types'
import type { ProposalItemSection } from '@/lib/proposals/constants'
import { isServiceRoleConfigured } from '@/lib/supabase/env'
import { measurementsFromUnknown } from '@/lib/proposals/boq-structure'

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function isExpired(validUntil: string | null, status: string) {
  if (!validUntil) return false
  if (status === 'draft' || status === 'withdrawn') return false
  return validUntil < todayIsoDate()
}

type VersionRow = {
  id: string
  proposal_id: string
  version_number: number
  method: ProposalMethod
  status: string
  title: string
  proposal_date: string
  valid_until: string | null
  notes: string
  built_up_total: number
  additional_works_total: number
  grand_total: number
  snapshot_project_name: string
  snapshot_client_name: string
  snapshot_project_address: string
  public_token: string | null
  shared_at: string | null
}

function emptyResponse(availability: PublicProposalAvailability): PublicProposalResponse {
  return {
    availability,
    is_historical: false,
    newer_available: false,
    current_share_path: null,
    can_request_revision: false,
    document: null,
  }
}

async function loadCompany(admin: ReturnType<typeof createAdminClient>) {
  const { data } = await admin
    .from('company_settings')
    .select('company_name, phone, email, address, logo_path')
    .eq('id', COMPANY_SETTINGS_ID)
    .maybeSingle()

  return {
    company_name: data?.company_name?.trim() || 'VRA HOMES',
    phone: data?.phone ?? null,
    email: data?.email ?? null,
    address: data?.address ?? null,
    logo_url: getCompanyLogoPublicUrl(admin, data?.logo_path) || '/images/vra-logo.png',
  }
}

function toDocument(
  version: VersionRow,
  items: PublicProposalItem[],
  proposalNumber: string,
  company: PublicProposalDocument['company'],
): PublicProposalDocument {
  return {
    proposal_number: formatProposalNumber(proposalNumber, version.version_number),
    title: version.title,
    version_number: version.version_number,
    method: version.method,
    proposal_date: version.proposal_date,
    valid_until: version.valid_until,
    project_name: version.snapshot_project_name,
    project_address: version.snapshot_project_address,
    client_name: version.snapshot_client_name,
    notes: version.notes,
    items,
    built_up_total: Number(version.built_up_total) || 0,
    additional_works_total: Number(version.additional_works_total) || 0,
    grand_total: Number(version.grand_total) || 0,
    company,
  }
}

export async function getPublicProposalByToken(token: string): Promise<PublicProposalResponse> {
  const trimmed = token.trim()
  if (!trimmed || trimmed.length < 16) return emptyResponse('unavailable')

  if (!isServiceRoleConfigured()) {
    return emptyResponse('unavailable')
  }

  const admin = createAdminClient()

  const company = await loadCompany(admin)

  const { data: proposalByShare } = await admin
    .from('proposals')
    .select('id, proposal_number, status, share_token')
    .eq('share_token', trimmed)
    .maybeSingle()

  let proposal = proposalByShare
  let version: VersionRow | null = null
  let matchedViaVersionToken = false

  if (proposal) {
    const { data: published } = await admin
      .from('proposal_versions')
      .select('*')
      .eq('proposal_id', proposal.id)
      .not('shared_at', 'is', null)
      .neq('status', 'draft')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    version = (published as VersionRow | null) ?? null
  } else {
    const { data: versionByToken } = await admin
      .from('proposal_versions')
      .select('*')
      .eq('public_token', trimmed)
      .maybeSingle()

    if (!versionByToken?.shared_at) return emptyResponse('unavailable')

    matchedViaVersionToken = true
    version = versionByToken as VersionRow
    const { data: parent } = await admin
      .from('proposals')
      .select('id, proposal_number, status, share_token')
      .eq('id', version.proposal_id)
      .maybeSingle()
    proposal = parent
  }

  if (proposal?.status === 'archived') return emptyResponse('unavailable')
  if (proposal?.status === 'withdrawn') return emptyResponse('withdrawn')
  if (!proposal || !version) return emptyResponse('unavailable')
  if (version.status === 'withdrawn') return emptyResponse('withdrawn')
  if (isExpired(version.valid_until, version.status)) {
    return emptyResponse('expired')
  }
  if (!version.shared_at || version.status === 'draft') {
    return emptyResponse('unavailable')
  }

  const { data: itemRows } = await admin
    .from('proposal_items')
    .select('section, sort_order, description, quantity, unit, rate, price, kind, measurements, nested')
    .eq('proposal_version_id', version.id)
    .order('sort_order', { ascending: true })

  const items: PublicProposalItem[] = (itemRows ?? []).map((item) => ({
    section: item.section as ProposalItemSection,
    sort_order: item.sort_order,
    description: item.description,
    quantity: Number(item.quantity) || 0,
    unit: item.unit,
    rate: Number(item.rate) || 0,
    price: Number(item.price) || 0,
    kind: item.kind === 'heading' ? 'heading' : 'item',
    measurements: measurementsFromUnknown(item.measurements),
    nested: Boolean(item.nested),
  }))

  const { data: latestPublished } = await admin
    .from('proposal_versions')
    .select('id, version_number')
    .eq('proposal_id', proposal.id)
    .not('shared_at', 'is', null)
    .neq('status', 'withdrawn')
    .neq('status', 'draft')
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const isHistorical = Boolean(
    matchedViaVersionToken && latestPublished && latestPublished.id !== version.id,
  )

  const canRequest =
    !isHistorical &&
    (version.status === 'shared' ||
      version.status === 'viewed' ||
      version.status === 'revision_requested')

  return {
    availability: 'ok',
    is_historical: isHistorical,
    newer_available: isHistorical,
    current_share_path: isHistorical && proposal.share_token ? `/proposal/${proposal.share_token}` : null,
    can_request_revision: canRequest,
    document: toDocument(version, items, proposal.proposal_number, company),
  }
}

export async function submitPublicRevisionRequest(
  token: string,
  message: string,
): Promise<{ ok: true } | { ok: false; error: string; availability?: PublicProposalAvailability }> {
  const trimmedToken = token.trim()
  const trimmedMessage = message.trim()
  if (!trimmedToken) return { ok: false, error: 'Proposal unavailable', availability: 'unavailable' }
  if (!trimmedMessage) return { ok: false, error: 'Please tell us what you’d like us to change.' }
  if (trimmedMessage.length > MAX_CLIENT_MESSAGE_LENGTH) {
    return { ok: false, error: 'Revision request is too long.' }
  }

  const viewed = await getPublicProposalByToken(trimmedToken)
  if (viewed.availability !== 'ok' || !viewed.document) {
    return {
      ok: false,
      error:
        viewed.availability === 'withdrawn'
          ? 'This proposal is no longer active.'
          : viewed.availability === 'expired'
            ? 'This proposal is no longer valid.'
            : 'This proposal link is invalid or no longer available.',
      availability: viewed.availability,
    }
  }
  if (!viewed.can_request_revision) {
    return { ok: false, error: 'This version of the proposal cannot receive revision requests.' }
  }

  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'Proposal unavailable', availability: 'unavailable' }
  }

  const { data: version } = await admin
    .from('proposal_versions')
    .select('id, proposal_id, version_number, status, public_token, shared_at')
    .eq('public_token', trimmedToken)
    .maybeSingle()

  const { data: proposalByShare } = await admin
    .from('proposals')
    .select('id, project_id, proposal_number, status, share_token, current_version_id')
    .eq('share_token', trimmedToken)
    .maybeSingle()

  let versionId = version?.id ?? null
  let proposalId = version?.proposal_id ?? proposalByShare?.id ?? null

  if (!versionId && proposalByShare) {
    const { data: published } = await admin
      .from('proposal_versions')
      .select('id, proposal_id, version_number, status')
      .eq('proposal_id', proposalByShare.id)
      .not('shared_at', 'is', null)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()
    versionId = published?.id ?? null
    proposalId = proposalByShare.id
  }

  if (!versionId || !proposalId) {
    return { ok: false, error: 'Proposal unavailable', availability: 'unavailable' }
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('proposal_revision_requests')
    .select('id', { count: 'exact', head: true })
    .eq('proposal_version_id', versionId)
    .gte('created_at', since)

  if ((count ?? 0) >= MAX_REVISION_REQUESTS_PER_HOUR) {
    return { ok: false, error: 'Too many revision requests. Please wait and try again.' }
  }

  const { data: proposal } = await admin
    .from('proposals')
    .select('id, project_id, created_by, proposal_number, status, current_version_id')
    .eq('id', proposalId)
    .maybeSingle()

  if (!proposal) return { ok: false, error: 'Proposal unavailable', availability: 'unavailable' }

  const { error: insertError } = await admin.from('proposal_revision_requests').insert({
    proposal_id: proposalId,
    proposal_version_id: versionId,
    client_message: trimmedMessage,
    status: 'open',
  })

  if (insertError) {
    return { ok: false, error: 'Could not send your revision request. Please try again.' }
  }

  await admin
    .from('proposal_versions')
    .update({ status: 'revision_requested' })
    .eq('id', versionId)
    .in('status', ['shared', 'viewed', 'revision_requested'])

  if (proposal.status !== 'revision_created' && proposal.current_version_id === versionId) {
    await admin.from('proposals').update({ status: 'revision_requested' }).eq('id', proposalId)
  } else if (proposal.status === 'shared' || proposal.status === 'viewed') {
    await admin.from('proposals').update({ status: 'revision_requested' }).eq('id', proposalId)
  }

  await recordProposalAudit(admin, {
    proposalId,
    proposalVersionId: versionId,
    eventType: 'revision_requested',
    actorRole: 'client',
    metadata: { message_preview: trimmedMessage.slice(0, 180) },
  })

  const { data: versionMeta } = await admin
    .from('proposal_versions')
    .select('version_number')
    .eq('id', versionId)
    .maybeSingle()

  try {
    await notifyStaffOnProposalRevision({
      projectId: proposal.project_id,
      createdBy: proposal.created_by,
      proposalId,
      proposalNumber: formatProposalNumber(proposal.proposal_number, versionMeta?.version_number),
      versionNumber: versionMeta?.version_number ?? viewed.document.version_number,
      messagePreview: trimmedMessage.slice(0, 140),
      dedupeKey: `proposal-revision:${versionId}:${Math.floor(Date.now() / (5 * 60 * 1000))}`,
    })
  } catch (error) {
    console.error('[proposals] revision notify failed', error)
  }

  return { ok: true }
}

export async function recordPublicProposalView(token: string): Promise<void> {
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return
  }

  const now = new Date().toISOString()
  const { data: byShare } = await admin
    .from('proposals')
    .select('id, status, current_version_id, share_token')
    .eq('share_token', token)
    .maybeSingle()

  if (byShare) {
    const { data: published } = await admin
      .from('proposal_versions')
      .select('id, status, first_viewed_at, shared_at')
      .eq('proposal_id', byShare.id)
      .not('shared_at', 'is', null)
      .neq('status', 'withdrawn')
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (published && (published.status === 'shared' || published.status === 'viewed')) {
      await admin
        .from('proposal_versions')
        .update({
          status: published.status === 'shared' ? 'viewed' : published.status,
          first_viewed_at: published.first_viewed_at ?? now,
          last_viewed_at: now,
        })
        .eq('id', published.id)

      if (byShare.status === 'shared') {
        await admin.from('proposals').update({ status: 'viewed' }).eq('id', byShare.id)
      }

      if (!published.first_viewed_at) {
        await recordProposalAudit(admin, {
          proposalId: byShare.id,
          proposalVersionId: published.id,
          eventType: 'viewed',
          actorRole: 'client',
        })
      }
    }
    return
  }

  const { data: byVersion } = await admin
    .from('proposal_versions')
    .select('id, proposal_id, status, first_viewed_at, shared_at')
    .eq('public_token', token)
    .maybeSingle()

  if (!byVersion?.shared_at) return

  if (byVersion.status === 'shared' || byVersion.status === 'viewed') {
    await admin
      .from('proposal_versions')
      .update({
        status: byVersion.status === 'shared' ? 'viewed' : byVersion.status,
        first_viewed_at: byVersion.first_viewed_at ?? now,
        last_viewed_at: now,
      })
      .eq('id', byVersion.id)
  }

  if (!byVersion.first_viewed_at) {
    const { data: proposal } = await admin
      .from('proposals')
      .select('status, current_version_id')
      .eq('id', byVersion.proposal_id)
      .maybeSingle()

    if (proposal?.status === 'shared' && proposal.current_version_id === byVersion.id) {
      await admin.from('proposals').update({ status: 'viewed' }).eq('id', byVersion.proposal_id)
    }

    await recordProposalAudit(admin, {
      proposalId: byVersion.proposal_id,
      proposalVersionId: byVersion.id,
      eventType: 'viewed',
      actorRole: 'client',
    })
  }
}

