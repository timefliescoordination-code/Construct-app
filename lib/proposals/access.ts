import type { UserRole } from '@/lib/types/database'
import { canManageProposals as canManageProposalsPermission } from '@/lib/permissions'

export function canManageProposals(role: UserRole | null): boolean {
  return canManageProposalsPermission(role)
}

export async function assertCanManageProject(
  supabase: {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{ data: { pm_id: string | null } | null; error: { message: string } | null }>
        }
      }
    }
  },
  projectId: string,
  auth: { role: 'admin' | 'pm'; userId: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (auth.role === 'admin') return { ok: true }

  const { data: project, error } = await supabase
    .from('projects')
    .select('pm_id')
    .eq('id', projectId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!project) return { ok: false, error: 'Project not found.' }
  if (project.pm_id !== auth.userId) {
    return { ok: false, error: 'You can only manage proposals for projects assigned to you.' }
  }
  return { ok: true }
}

export function isDraftVersionStatus(status: string): boolean {
  return status === 'draft'
}

export function isPublishedVersionStatus(status: string): boolean {
  return status === 'shared' || status === 'viewed' || status === 'revision_requested'
}

export function canEditProposalVersion(status: string, sharedAt: string | null): boolean {
  return status === 'draft' && !sharedAt
}

export function canShareProposalVersion(status: string, sharedAt: string | null): boolean {
  return status === 'draft' && !sharedAt
}

export function canCreateRevisionFromStatus(status: string, sharedAt: string | null): boolean {
  if (status === 'draft' || status === 'withdrawn' || status === 'archived') return false
  return Boolean(sharedAt)
}

export function publicSharePath(token: string): string {
  return `/proposal/${token}`
}
