'use client'

import Link from 'next/link'
import { ProposalsList } from '@/components/proposals/proposals-list'

export function ProjectProposalsTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Proposals</h2>
          <p className="text-sm text-muted-foreground">
            Quotations that were moved onto this project. New proposals are created from the{' '}
            <Link href="/proposals" className="text-primary hover:underline">
              Proposals
            </Link>{' '}
            page.
          </p>
        </div>
      </div>
      <ProposalsList projectId={projectId} />
    </div>
  )
}
