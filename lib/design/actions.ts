'use server'

import { revalidatePath } from 'next/cache'
import {
  createDesignFileRecord,
  deleteDesignFileRecord,
  addDesignCommentRecord,
} from '@/lib/data/design-files'
import { validateDesignFile, resolveDesignMimeType } from '@/lib/design/validate'
import type { TabActionResult } from '@/lib/projects/tab-actions'
import type { ProjectDesignFile, ProjectDesignComment } from '@/lib/types/database'

function revalidateDesignPaths(projectId: string) {
  revalidatePath(`/projects/${projectId}`)
  revalidatePath('/customer')
}

export async function uploadDesignFileAction(
  formData: FormData,
): Promise<TabActionResult<ProjectDesignFile>> {
  const projectId = formData.get('projectId')
  const file = formData.get('file')
  const title = formData.get('title')
  const revisionLabel = formData.get('revisionLabel')

  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, error: 'Project ID is required.' }
  }

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Design file is required.' }
  }

  const validation = validateDesignFile(file)
  if (!validation.valid) {
    return { ok: false, error: validation.error ?? 'Invalid design file.' }
  }

  const mimeType = resolveDesignMimeType(file)
  const fileBuffer = await file.arrayBuffer()

  const { data, error } = await createDesignFileRecord({
    projectId,
    fileName: file.name,
    mimeType,
    fileBuffer,
    title: typeof title === 'string' ? title : undefined,
    revisionLabel: typeof revisionLabel === 'string' ? revisionLabel : null,
  })

  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to upload design file.' }
  }

  revalidateDesignPaths(projectId)
  return { ok: true, data }
}

export async function deleteDesignFileAction(
  projectId: string,
  designFileId: string,
): Promise<TabActionResult<null>> {
  const result = await deleteDesignFileRecord(projectId, designFileId)

  if ('error' in result) {
    return { ok: false, error: result.error }
  }

  revalidateDesignPaths(projectId)
  return { ok: true, data: null }
}

export async function addDesignCommentAction(
  projectId: string,
  designFileId: string,
  body: string,
): Promise<TabActionResult<ProjectDesignComment>> {
  const { data, error } = await addDesignCommentRecord(designFileId, body)

  if (error || !data) {
    return { ok: false, error: error ?? 'Failed to add comment.' }
  }

  revalidateDesignPaths(projectId)
  return { ok: true, data }
}
