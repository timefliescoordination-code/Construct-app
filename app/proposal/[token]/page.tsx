import { Metadata } from 'next'
import { PublicProposalPage } from '@/components/proposals/public-proposal-page'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Construction Proposal | VRA HOMES',
  description: 'VRA Homes construction proposal',
  robots: { index: false, follow: false },
}

export default async function PublicProposalRoute({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  return <PublicProposalPage token={token} />
}
