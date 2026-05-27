import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseErrorMessage } from '@/lib/supabase/db-errors'
import type { AppNotification } from '@/lib/notifications'

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, project_id, expense_id, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) {
    const message = getSupabaseErrorMessage(error)
    if (message.includes('Could not find the table')) {
      return NextResponse.json({ data: [], unreadCount: 0 })
    }
    return NextResponse.json({ error: message }, { status: 500 })
  }

  const notifications = (data ?? []) as AppNotification[]
  const unreadCount = notifications.filter((n) => !n.read_at).length

  return NextResponse.json({ data: notifications, unreadCount })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    notificationId?: string
    markAllRead?: boolean
  }

  if (body.markAllRead) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)

    if (error) {
      return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  }

  if (!body.notificationId) {
    return NextResponse.json({ error: 'notificationId is required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', body.notificationId)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: getSupabaseErrorMessage(error) }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
