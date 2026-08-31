'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminSession, type SupabaseServerClient } from '@/lib/auth/require-admin'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { COMPANY_LOGO_CONFIG, COMPANY_SETTINGS_ID } from '@/lib/company/constants'
import { deleteCompanyLogoFile, uploadCompanyLogoFile } from '@/lib/company/storage'
import { getCompanySettings } from '@/lib/company/settings'

type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

function normalizeOptional(value: FormDataEntryValue | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function syncAdminProfileCompanyFields(
  supabase: SupabaseServerClient,
  companyName: string | null,
  phone: string | null,
) {
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)

  const adminId = admins?.[0]?.id
  if (!adminId) return

  await supabase
    .from('profiles')
    .update({
      company_name: companyName,
      phone: phone,
      updated_at: new Date().toISOString(),
    })
    .eq('id', adminId)
}

export async function updateCompanySettingsAction(
  formData: FormData,
): Promise<ActionResult> {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth

  const companyName = normalizeOptional(formData.get('company_name'))
  const phone = normalizeOptional(formData.get('phone'))
  const email = normalizeOptional(formData.get('email'))
  const address = normalizeOptional(formData.get('address'))
  const website = normalizeOptional(formData.get('website'))
  const proposalDefaultNotes = normalizeOptional(formData.get('proposal_default_notes'))

  if (!companyName) {
    return { ok: false, error: 'Company name is required.' }
  }

  if (!phone) {
    return { ok: false, error: 'Company phone number is required.' }
  }

  const { error } = await auth.supabase
    .from('company_settings')
    .upsert({
      id: COMPANY_SETTINGS_ID,
      company_name: companyName,
      phone,
      email,
      address,
      website,
      proposal_default_notes: proposalDefaultNotes,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  await syncAdminProfileCompanyFields(auth.supabase, companyName, phone)

  revalidatePath('/admin/company')
  revalidatePath('/admin')
  return { ok: true }
}

export async function uploadCompanyLogoAction(
  formData: FormData,
): Promise<ActionResult<{ logo_url: string | null }>> {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth

  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Select a logo image to upload.' }
  }

  if (file.size > COMPANY_LOGO_CONFIG.maxFileSizeBytes) {
    return {
      ok: false,
      error: `Logo must be ${COMPANY_LOGO_CONFIG.maxFileSizeMB}MB or smaller.`,
    }
  }

  const mimeType = file.type || 'image/jpeg'
  if (
    !COMPANY_LOGO_CONFIG.allowedMimeTypes.includes(
      mimeType as (typeof COMPANY_LOGO_CONFIG.allowedMimeTypes)[number],
    )
  ) {
    return { ok: false, error: 'Upload a JPG, PNG, WebP, or SVG logo.' }
  }

  const { data: existing } = await getCompanySettings(auth.supabase)
  if (existing?.logo_path) {
    await deleteCompanyLogoFile(auth.supabase, existing.logo_path)
  }

  const upload = await uploadCompanyLogoFile(
    auth.supabase,
    mimeType,
    Buffer.from(await file.arrayBuffer()),
  )

  if ('error' in upload) {
    return { ok: false, error: upload.error }
  }

  const { error } = await auth.supabase
    .from('company_settings')
    .upsert({
      id: COMPANY_SETTINGS_ID,
      logo_path: upload.filePath,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  const refreshed = await getCompanySettings(auth.supabase)

  revalidatePath('/admin/company')
  return { ok: true, data: { logo_url: refreshed.data?.logo_url ?? null } }
}

export async function removeCompanyLogoAction(): Promise<ActionResult> {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth

  const { data: existing } = await getCompanySettings(auth.supabase)
  if (existing?.logo_path) {
    await deleteCompanyLogoFile(auth.supabase, existing.logo_path)
  }

  const { error } = await auth.supabase
    .from('company_settings')
    .update({
      logo_path: null,
      updated_by: auth.user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', COMPANY_SETTINGS_ID)

  if (error) {
    return { ok: false, error: getSupabaseErrorMessage(error) }
  }

  revalidatePath('/admin/company')
  return { ok: true }
}

export async function getCompanySettingsAction(): Promise<
  ActionResult<{ settings: Awaited<ReturnType<typeof getCompanySettings>>['data'] }>
> {
  const auth = await requireAdminSession()
  if (!auth.ok) return auth

  const { data, error } = await getCompanySettings(auth.supabase)
  if (error) {
    return { ok: false, error }
  }

  return { ok: true, data: { settings: data } }
}
