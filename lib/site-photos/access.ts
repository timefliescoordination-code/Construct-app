import type { SupabaseClient } from '@supabase/supabase-js'
import type { UserRole } from '@/lib/types/database'
import { canUploadSitePhotos } from '@/lib/permissions'

export async function canUserUploadSitePhotosToProject(
  supabase: SupabaseClient,
  userId: string,
  role: UserRole,
  projectId: string,
): Promise<boolean> {
  if (!canUploadSitePhotos(role)) return false
  if (role === 'admin') return true

  if (role === 'pm') {
    const { data } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('pm_id', userId)
      .maybeSingle()
    return !!data
  }

  if (role === 'engineer') {
    const { data } = await supabase
      .from('project_engineers')
      .select('project_id')
      .eq('project_id', projectId)
      .eq('engineer_id', userId)
      .maybeSingle()
    return !!data
  }

  return false
}
