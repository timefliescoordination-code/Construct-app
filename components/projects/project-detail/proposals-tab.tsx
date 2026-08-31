'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProposalsList } from '@/components/proposals/proposals-list'

export function ProjectProposalsTab({ projectId }: { projectId: string }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Proposals</h2>
          <p className="text-sm text-muted-foreground">
            Formal quotations for this project. Shared versions are never overwritten.
          </p>
        </div>
        <Button asChild>
          <Link href={`/proposals/new?projectId=${projectId}`}>
            <Plus className="mr-2 h-4 w-4" />
            Create proposal
          </Link>
        </Button>
      </div>
      <ProposalsList projectId={projectId} />
    </div>
  )
}
