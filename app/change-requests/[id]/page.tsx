import { Metadata } from 'next'
import { ChangeRequestDetailContent } from '@/components/change-requests/change-request-detail-content'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageMain, PageShell } from '@/components/layout/page'

export const metadata: Metadata = {
  title: 'Change Request | VRA HOMES',
}

export const dynamic = 'force-dynamic'

export default async function ChangeRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <ChangeRequestDetailContent requestId={id} />
      </PageMain>
    </PageShell>
  )
}
