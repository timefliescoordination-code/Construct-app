import { Metadata } from 'next'
import { InspectionsHub } from '@/components/quality/inspections-hub'
import { DashboardHeader } from '@/components/dashboard/header'
import { PageHeader, PageMain, PageShell } from '@/components/layout/page'

export const metadata: Metadata = {
  title: 'Quality inspections | VRA HOMES',
  description: 'Construction quality checklists and inspection review',
}

export const dynamic = 'force-dynamic'

export default function InspectionsPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Quality inspections"
          description="Inspect construction work against specification, capture evidence, and review approvals."
        />
        <InspectionsHub />
      </PageMain>
    </PageShell>
  )
}
