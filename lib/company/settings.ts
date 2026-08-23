import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPANY_SETTINGS_ID } from '@/lib/company/constants'
import { getCompanyLogoPublicUrl } from '@/lib/company/storage'
import type { CompanySettings } from '@/lib/types/database'

export type CompanySettingsView = CompanySettings & {
  logo_url: string | null
}

export async function getCompanySettings(
  supabase: SupabaseClient,
): Promise<{ data: CompanySettingsView | null; error: string | null }> {
  const { data, error } = await supabase
    .from('company_settings')
    .select('*')
    .eq('id', COMPANY_SETTINGS_ID)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }

  if (!data) {
    return { data: null, error: null }
  }

  return {
    data: {
      ...(data as CompanySettings),
      logo_url: getCompanyLogoPublicUrl(supabase, data.logo_path),
    },
    error: null,
  }
}

export type CompanyBranding = {
  company_name: string | null
  logo_url: string | null
}

export async function getCompanyBranding(
  supabase: SupabaseClient,
): Promise<CompanyBranding> {
  const { data } = await supabase
    .from('company_settings')
    .select('company_name, logo_path')
    .eq('id', COMPANY_SETTINGS_ID)
    .maybeSingle()

  return {
    company_name: data?.company_name?.trim() || null,
    logo_url: getCompanyLogoPublicUrl(supabase, data?.logo_path),
  }
}
