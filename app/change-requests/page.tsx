import { Metadata } from 'next'
import { ChangeRequestsDashboard } from '@/components/change-requests/change-requests-dashboard'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageHeader, PageMain, PageShell } from '@/components/layout/page'

export const metadata: Metadata = {
  title: 'Change Requests | VRA HOMES',
  description: 'Customer construction change requests',
}

export const dynamic = 'force-dynamic'

export default function ChangeRequestsPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Change requests"
          description="Review customer change requests, prepare estimates, and track approvals"
        />
        <ChangeRequestsDashboard />
      </PageMain>
    </PageShell>
  )
}
