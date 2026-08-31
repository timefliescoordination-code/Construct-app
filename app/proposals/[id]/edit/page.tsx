import { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { fetchProposalDetail } from '@/lib/proposals/queries'
import { canEditProposalVersion, canManageProposals } from '@/lib/proposals/access'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageMain, PageShell } from '@/components/layout/page'
import { ProposalEditor } from '@/components/proposals/proposal-editor'
import type { UserRole } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Edit proposal | VRA HOMES',
}

export default async function EditProposalPage({
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

  const current =
    proposal.versions.find((version) => version.id === proposal.current_version_id) ?? proposal.versions[0]
  if (!current || !canEditProposalVersion(current.status, current.shared_at)) {
    redirect(`/proposals/${id}`)
  }

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <ProposalEditor mode="edit" proposal={proposal} />
      </PageMain>
    </PageShell>
  )
}
