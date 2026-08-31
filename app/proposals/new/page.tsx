import { Metadata } from 'next'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageMain, PageShell } from '@/components/layout/page'
import { ProposalEditor } from '@/components/proposals/proposal-editor'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Create proposal | VRA HOMES',
  description: 'Create a construction proposal',
}

export default function NewProposalPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <ProposalEditor mode="create" />
      </PageMain>
    </PageShell>
  )
}
