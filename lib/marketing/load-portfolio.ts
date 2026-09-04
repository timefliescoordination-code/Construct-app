import type { SupabaseClient } from '@supabase/supabase-js'
import { isDatabaseSetupError } from '@/lib/supabase/db-errors'
import { isMissingQualityTablesError } from '@/lib/quality/db'
import { builtUpSqftFromItems } from '@/lib/marketing/sanitize-project'
import type { RawAdditionalWorkInput, RawChangeRequestInput, RawExpenseInput, RawProjectInput } from '@/lib/marketing/types'

type AnyClient = SupabaseClient

function isSkippableLookupError(error: unknown): boolean {
  if (isDatabaseSetupError(error) || isMissingQualityTablesError(error)) return true
  if (!error || typeof error !== 'object') return false
  const err = error as { code?: string; message?: string }
  return (
    err.code === 'PGRST200' ||
    err.code === '42P01' ||
    !!err.message?.includes('Could not find a relationship')
  )
}

async function optionalRows<T>(
  promise: PromiseLike<{ data: T[] | null; error: { message?: string; code?: string } | null }>,
  isOptionalError: (error: unknown) => boolean = isSkippableLookupError,
): Promise<T[]> {
  const { data, error } = await promise
  if (error) {
    if (isOptionalError(error)) return []
    throw error
  }
  return data ?? []
}

function asNumber(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function workTypeFromEmbed(template: unknown): string | null {
  if (Array.isArray(template)) {
    const first = template[0] as { work_type?: string } | undefined
    return typeof first?.work_type === 'string' ? first.work_type : null
  }
  if (template && typeof template === 'object' && 'work_type' in template) {
    const value = (template as { work_type?: unknown }).work_type
    return typeof value === 'string' ? value : null
  }
  return null
}

type ProposalRow = {
  id: string
  project_id: string | null
  proposal_number: string
  status: string
  current_version_id: string | null
  proposed_client_name: string | null
  proposed_client_phone: string | null
  proposed_client_email: string | null
  proposed_project_name: string | null
  proposed_site_address: string | null
}

function pickProposal(rows: ProposalRow[]): ProposalRow | null {
  if (!rows.length) return null
  const accepted = rows.filter((row) => row.status === 'accepted')
  return (accepted[0] ?? rows[0]) ?? null
}

export async function loadRawProjectsForMarketing(supabase: AnyClient): Promise<RawProjectInput[]> {
  const projectsResult = await supabase
    .from('projects')
    .select(
      'id, name, status, client_name, client_phone, site_address, contract_value, additional_works_value, start_date, expected_completion_date',
    )
    .neq('status', 'archived')
    .order('created_at', { ascending: false })

  if (projectsResult.error) {
    throw projectsResult.error
  }

  const projects = projectsResult.data ?? []
  if (!projects.length) return []

  const projectIds = projects.map((row) => row.id as string)

  const [milestones, expenses, additionalWorks, changeRequests, proposals, inspections] =
    await Promise.all([
      optionalRows(
        supabase.from('milestones').select('project_id, name').in('project_id', projectIds),
      ),
      optionalRows(
        supabase
          .from('expenses')
          .select('project_id, amount, category, status, vendor_name, bill_number, description')
          .in('project_id', projectIds)
          .eq('status', 'approved'),
      ),
      optionalRows(
        supabase
          .from('additional_works')
          .select('project_id, approval_status, description')
          .in('project_id', projectIds),
      ),
      optionalRows(
        supabase
          .from('construction_change_requests')
          .select('project_id, category, status, request_number, title, description')
          .in('project_id', projectIds),
      ),
      optionalRows(
        supabase
          .from('proposals')
          .select(
            'id, project_id, proposal_number, status, current_version_id, proposed_client_name, proposed_client_phone, proposed_client_email, proposed_project_name, proposed_site_address',
          )
          .in('project_id', projectIds)
          .neq('status', 'archived'),
      ),
      optionalRows(
        supabase
          .from('quality_inspections')
          .select('project_id, template:quality_checklist_templates(work_type)')
          .in('project_id', projectIds),
      ),
    ])

  const versionIds = Array.from(
    new Set(
      (proposals as ProposalRow[])
        .map((row) => row.current_version_id)
        .filter((id): id is string => Boolean(id)),
    ),
  )

  const versions = versionIds.length
    ? await optionalRows(
        supabase.from('proposal_versions').select('id, method').in('id', versionIds),
      )
    : []

  const versionMethod = new Map<string, 'sqft' | 'boq'>()
  for (const version of versions) {
    const method = version.method
    if (method === 'sqft' || method === 'boq') {
      versionMethod.set(version.id as string, method)
    }
  }

  const items = versionIds.length
    ? await optionalRows(
        supabase
          .from('proposal_items')
          .select('proposal_version_id, section, quantity, unit')
          .in('proposal_version_id', versionIds)
          .eq('section', 'built_up'),
      )
    : []

  const itemsByVersion = new Map<string, typeof items>()
  for (const item of items) {
    const versionId = item.proposal_version_id as string
    const list = itemsByVersion.get(versionId) ?? []
    list.push(item)
    itemsByVersion.set(versionId, list)
  }

  const milestonesByProject = groupByProject(milestones)
  const expensesByProject = groupByProject(expenses)
  const additionalByProject = groupByProject(additionalWorks)
  const changesByProject = groupByProject(changeRequests)
  const proposalsByProject = new Map<string, ProposalRow[]>()
  for (const row of proposals as ProposalRow[]) {
    if (!row.project_id) continue
    const list = proposalsByProject.get(row.project_id) ?? []
    list.push(row)
    proposalsByProject.set(row.project_id, list)
  }
  const workTypesByProject = new Map<string, string[]>()
  for (const row of inspections) {
    const projectId = row.project_id as string
    const workType = workTypeFromEmbed(row.template)
    if (!workType) continue
    const list = workTypesByProject.get(projectId) ?? []
    list.push(workType)
    workTypesByProject.set(projectId, list)
  }

  return projects.map((project) => {
    const id = project.id as string
    const proposal = pickProposal(proposalsByProject.get(id) ?? [])
    const versionId = proposal?.current_version_id ?? null
    const builtUpQuantity = versionId
      ? builtUpSqftFromItems(itemsByVersion.get(versionId) ?? [])
      : null

    return {
      id,
      name: String(project.name ?? ''),
      status: String(project.status ?? ''),
      clientName: String(project.client_name ?? ''),
      clientPhone: (project.client_phone as string | null) ?? null,
      siteAddress: String(project.site_address ?? ''),
      contractValue: asNumber(project.contract_value) || null,
      additionalWorksValue: asNumber(project.additional_works_value) || null,
      startDate: (project.start_date as string | null) ?? null,
      expectedCompletionDate: (project.expected_completion_date as string | null) ?? null,
      milestones: (milestonesByProject.get(id) ?? []).map((row) => ({
        name: String(row.name ?? ''),
      })),
      expenses: (expensesByProject.get(id) ?? []).map(
        (row): RawExpenseInput => ({
          amount: asNumber(row.amount),
          category: String(row.category ?? ''),
          status: String(row.status ?? ''),
          vendorName: (row.vendor_name as string | null) ?? null,
          billNumber: (row.bill_number as string | null) ?? null,
          description: (row.description as string | null) ?? null,
        }),
      ),
      additionalWorks: (additionalByProject.get(id) ?? []).map(
        (row): RawAdditionalWorkInput => ({
          approvalStatus: String(row.approval_status ?? ''),
          description: (row.description as string | null) ?? null,
        }),
      ),
      changeRequests: (changesByProject.get(id) ?? []).map(
        (row): RawChangeRequestInput => ({
          category: String(row.category ?? ''),
          status: String(row.status ?? ''),
          requestNumber: (row.request_number as string | null) ?? null,
          title: (row.title as string | null) ?? null,
          description: (row.description as string | null) ?? null,
        }),
      ),
      proposal: proposal
        ? {
            method: versionId ? versionMethod.get(versionId) ?? null : null,
            proposalNumber: proposal.proposal_number,
            builtUpQuantity,
            clientName: proposal.proposed_client_name,
            clientPhone: proposal.proposed_client_phone,
            clientEmail: proposal.proposed_client_email,
            projectName: proposal.proposed_project_name,
            siteAddress: proposal.proposed_site_address,
          }
        : null,
      inspectionWorkTypes: workTypesByProject.get(id) ?? [],
    }
  })
}

function groupByProject<T extends { project_id?: unknown }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const projectId = String(row.project_id ?? '')
    if (!projectId) continue
    const list = map.get(projectId) ?? []
    list.push(row)
    map.set(projectId, list)
  }
  return map
}
