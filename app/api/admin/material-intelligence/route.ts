import { listMaterialMasterPaginated } from '@/lib/data/materials'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import { MATERIAL_INTELLIGENCE_PAGE_SIZE } from '@/lib/materials/constants'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

async function requireAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
  }

  return { ok: true as const }
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const pageParam = Number(request.nextUrl.searchParams.get('page') ?? '1')
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1

  const { data, error } = await listMaterialMasterPaginated({
    page,
    pageSize: MATERIAL_INTELLIGENCE_PAGE_SIZE,
  })

  if (error) {
    return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 400 })
  }

  return NextResponse.json({ data })
}
