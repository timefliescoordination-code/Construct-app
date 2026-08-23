import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import {
  uploadDesignFile,
  deleteDesignFileFromStorage,
  createSignedDesignFileUrl,
  downloadDesignFileBuffer,
} from '@/lib/design/storage'
import { applyWatermarkToImage } from '@/lib/design/watermark'
import { isWatermarkableImageMime } from '@/lib/design/validate'
import { notifyDesignUpdate } from '@/lib/notifications'
import type {
  ProjectDesignFile,
  ProjectDesignFileWithComments,
  ProjectDesignComment,
} from '@/lib/types/database'
import { getProjectAccessScope } from '@/lib/project-access'

export type UploadDesignFileInput = {
  projectId: string
  fileName: string
  mimeType: string
  fileBuffer: ArrayBuffer
  title?: string
  revisionLabel?: string | null
}

export async function listDesignFilesForProject(
  projectId: string,
): Promise<{ data: ProjectDesignFileWithComments[] | null; error: string | null }> {
  const supabase = await createClient()
  const access = await getProjectAccessScope(supabase)

  if (!access) {
    return { data: null, error: 'You must be signed in.' }
  }

  const { data: files, error } = await supabase
    .from('project_design_files')
    .select(
      `
      *,
      uploader:profiles!uploaded_by(id, email, full_name, role, phone, company_name, created_at, updated_at),
      comments:project_design_comments(
        *,
        author:profiles!author_id(id, email, full_name, role, phone, company_name, created_at, updated_at)
      )
    `,
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  const rows = (files ?? []).map((row) => {
    const comments = (row.comments ?? []) as (ProjectDesignComment & {
      author?: ProjectDesignFileWithComments['uploader']
    })[]
    comments.sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    return {
      ...(row as ProjectDesignFile),
      uploader: row.uploader ?? null,
      comments,
    }
  })

  return { data: rows, error: null }
}

export async function createDesignFileRecord(
  input: UploadDesignFileInput,
): Promise<{ data: ProjectDesignFile | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in to upload design files.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'admin' && profile?.role !== 'pm') {
    return { data: null, error: 'Only admins and project managers can upload design files.' }
  }

  const designFileId = crypto.randomUUID()

  const upload = await uploadDesignFile(supabase, {
    projectId: input.projectId,
    designFileId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileBuffer: input.fileBuffer,
  })

  if ('error' in upload) {
    return { data: null, error: upload.error }
  }

  const { data, error } = await supabase
    .from('project_design_files')
    .insert({
      id: designFileId,
      project_id: input.projectId,
      file_path: upload.filePath,
      file_name: input.fileName,
      file_mime_type: input.mimeType,
      title: input.title?.trim() || input.fileName,
      revision_label: input.revisionLabel?.trim() || null,
      uploaded_by: user.id,
    })
    .select('*')
    .single()

  if (error) {
    await deleteDesignFileFromStorage(supabase, upload.filePath)
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  await notifyDesignUpdate(supabase, {
    projectId: input.projectId,
    designFileId: designFileId,
    designName: (data as ProjectDesignFile).title,
  })

  return { data: data as ProjectDesignFile, error: null }
}

export async function deleteDesignFileRecord(
  projectId: string,
  designFileId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'You must be signed in.' }
  }

  const { data: file, error: fetchError } = await supabase
    .from('project_design_files')
    .select('id, project_id, file_path')
    .eq('id', designFileId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (fetchError) {
    return { error: getSupabaseErrorMessage(fetchError) }
  }

  if (!file) {
    return { error: 'Design file not found.' }
  }

  const { error: deleteRowError } = await supabase
    .from('project_design_files')
    .delete()
    .eq('id', designFileId)

  if (deleteRowError) {
    return { error: getSupabaseErrorMessage(deleteRowError) }
  }

  const storageResult = await deleteDesignFileFromStorage(supabase, file.file_path)
  if ('error' in storageResult) {
    console.error('[deleteDesignFileRecord] storage:', storageResult.error)
  }

  return { ok: true }
}

export async function addDesignCommentRecord(
  designFileId: string,
  body: string,
): Promise<{ data: ProjectDesignComment | null; error: string | null }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: null, error: 'You must be signed in.' }
  }

  const trimmed = body.trim()
  if (!trimmed) {
    return { data: null, error: 'Comment cannot be empty.' }
  }

  const { data, error } = await supabase
    .from('project_design_comments')
    .insert({
      design_file_id: designFileId,
      author_id: user.id,
      body: trimmed,
    })
    .select('*')
    .single()

  if (error) {
    return { data: null, error: getSupabaseErrorMessage(error) }
  }

  return { data: data as ProjectDesignComment, error: null }
}

async function getDesignFileForProject(
  projectId: string,
  designFileId: string,
): Promise<{ file: ProjectDesignFile | null; error: string | null }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('project_design_files')
    .select('*')
    .eq('id', designFileId)
    .eq('project_id', projectId)
    .maybeSingle()

  if (error) {
    return { file: null, error: getSupabaseErrorMessage(error) }
  }

  if (!data) {
    return { file: null, error: 'Design file not found.' }
  }

  return { file: data as ProjectDesignFile, error: null }
}

export async function getDesignFileViewUrl(
  projectId: string,
  designFileId: string,
): Promise<{ url: string } | { error: string }> {
  const { file, error } = await getDesignFileForProject(projectId, designFileId)
  if (error || !file) {
    return { error: error ?? 'Design file not found.' }
  }

  const supabase = await createClient()
  const signed = await createSignedDesignFileUrl(supabase, file.file_path)

  if ('error' in signed) {
    return { error: signed.error }
  }

  return { url: signed.url }
}

export async function getWatermarkedDesignFileDownload(
  projectId: string,
  designFileId: string,
): Promise<
  | { buffer: Buffer; contentType: string; fileName: string }
  | { error: string; status?: number }
> {
  const { file, error } = await getDesignFileForProject(projectId, designFileId)
  if (error || !file) {
    return { error: error ?? 'Design file not found.', status: 404 }
  }

  if (!isWatermarkableImageMime(file.file_mime_type)) {
    return {
      error: 'Watermarked download is available for image files only. Use view for PDFs.',
      status: 400,
    }
  }

  const supabase = await createClient()
  const downloaded = await downloadDesignFileBuffer(supabase, file.file_path)

  if ('error' in downloaded) {
    return { error: downloaded.error, status: 500 }
  }

  const watermarked = await applyWatermarkToImage(
    downloaded.buffer,
    file.file_mime_type,
  )

  const baseName = file.file_name.replace(/\.[^.]+$/, '')
  const ext =
    watermarked.contentType === 'image/png'
      ? 'png'
      : watermarked.contentType === 'image/webp'
        ? 'webp'
        : 'jpg'

  return {
    buffer: watermarked.buffer,
    contentType: watermarked.contentType,
    fileName: `${baseName}-watermarked.${ext}`,
  }
}
