import { Metadata } from 'next'
import { InspectionDetailContent } from '@/components/quality/inspection-detail-content'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageMain, PageShell } from '@/components/layout/page'

export const metadata: Metadata = {
  title: 'Inspection | VRA HOMES',
}

export const dynamic = 'force-dynamic'

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <InspectionDetailContent inspectionId={id} />
      </PageMain>
    </PageShell>
  )
}
