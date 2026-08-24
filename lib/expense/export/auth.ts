import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/lib/types/database'
import { canExportExpenses } from '@/lib/expense/export/permissions'
import { NextResponse } from 'next/server'

export type ExpenseExportAuth = {
  supabase: Awaited<ReturnType<typeof createClient>>
  userId: string
  role: UserRole
}

export async function requireExpenseExportAuth(): Promise<
  { ok: true; auth: ExpenseExportAuth } | { ok: false; error: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  const role = profile?.role as UserRole | undefined
  if (!role || role === 'customer') {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  if (!canExportExpenses(role)) {
    return {
      ok: false,
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    }
  }

  return {
    ok: true,
    auth: { supabase, userId: user.id, role },
  }
}

export async function getCompanyNameForExport(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  const { data } = await supabase
    .from('company_settings')
    .select('company_name')
    .maybeSingle()

  return data?.company_name?.trim() || 'VRA HOMES'
}
