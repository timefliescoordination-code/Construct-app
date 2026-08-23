import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/env'
import { absoluteAppUrl } from '@/lib/app-url'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient()
      await supabase.auth.signOut()
    } catch (error) {
      console.error('[auth/signout] sign out failed:', error)
    }
  }

  return NextResponse.redirect(absoluteAppUrl('/login', request))
}
