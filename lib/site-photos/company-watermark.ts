import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY_SETTINGS_ID } from '@/lib/company/constants'

export type CompanyWatermarkDetails = {
  companyName: string
  companyPhone: string
  watermarkText: string
}

export async function getCompanyWatermarkDetails(
  supabase: SupabaseClient,
): Promise<{ data: CompanyWatermarkDetails | null; error: string | null }> {
  const { data: companySettings, error: settingsError } = await supabase
    .from('company_settings')
    .select('company_name, phone')
    .eq('id', COMPANY_SETTINGS_ID)
    .maybeSingle()

  if (settingsError) {
    return { data: null, error: settingsError.message }
  }

  let companyName = companySettings?.company_name?.trim() ?? ''
  let companyPhone = companySettings?.phone?.trim() ?? ''

  if (!companyName || !companyPhone) {
    const { data: adminProfile, error: profileError } = await supabase
      .from('profiles')
      .select('company_name, phone')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (profileError) {
      return { data: null, error: profileError.message }
    }

    if (!companyName) {
      companyName = adminProfile?.company_name?.trim() ?? ''
    }
    if (!companyPhone) {
      companyPhone = adminProfile?.phone?.trim() ?? ''
    }
  }

  if (!companyName || !companyPhone) {
    return {
      data: null,
      error:
        'Company name and phone are required before site photos can be uploaded. Update Company Details in the admin sidebar.',
    }
  }

  return {
    data: {
      companyName,
      companyPhone,
      watermarkText: `${companyName} | ${companyPhone}`,
    },
    error: null,
  }
}
