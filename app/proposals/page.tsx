import { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageHeader, PageMain, PageShell } from '@/components/layout/page'
import { Button } from '@/components/ui/button'
import { ProposalsList } from '@/components/proposals/proposals-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Proposals | VRA HOMES',
  description: 'Construction proposals and quotations',
}

export default function ProposalsPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Proposals"
          description="Create quotations with proposed project details. They become projects only when moved to the project list."
        >
          <Button asChild>
            <Link href="/proposals/new">
              <Plus className="mr-2 h-4 w-4" />
              Create proposal
            </Link>
          </Button>
        </PageHeader>
        <ProposalsList />
      </PageMain>
    </PageShell>
  )
}
