import type { SupabaseClient } from '@supabase/supabase-js'

export type CompanyWatermarkDetails = {
  companyName: string
  companyPhone: string
  watermarkText: string
}

export async function getCompanyWatermarkDetails(
  supabase: SupabaseClient,
): Promise<{ data: CompanyWatermarkDetails | null; error: string | null }> {
  const { data: adminProfile, error } = await supabase
    .from('profiles')
    .select('company_name, phone')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    return { data: null, error: error.message }
  }

  const companyName = adminProfile?.company_name?.trim() ?? ''
  const companyPhone = adminProfile?.phone?.trim() ?? ''

  if (!companyName || !companyPhone) {
    return {
      data: null,
      error:
        'Company name and phone are required on the company admin profile before site photos can be uploaded. Update the admin account in User Management.',
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
