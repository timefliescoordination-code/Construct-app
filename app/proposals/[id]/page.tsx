import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchProposalDetail } from '@/lib/proposals/queries'
import { canManageProposals } from '@/lib/proposals/access'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageMain, PageShell } from '@/components/layout/page'
import { ProposalDetailContent } from '@/components/proposals/proposal-detail-content'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Proposal | VRA HOMES',
}

export default async function ProposalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (!canManageProposals((profile?.role ?? null) as UserRole | null)) {
    redirect('/')
  }

  const proposal = await fetchProposalDetail(supabase, id)
  if (!proposal) notFound()

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <ProposalDetailContent proposal={proposal} />
      </PageMain>
    </PageShell>
  )
}
