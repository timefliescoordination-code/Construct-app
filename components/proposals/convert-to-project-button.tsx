'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderPlus, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { convertProposalToProjectAction } from '@/lib/proposals/actions'

export function ConvertToProjectButton({
  proposalId,
  className,
  beforeConvert,
}: {
  proposalId: string
  className?: string
  beforeConvert?: () => Promise<boolean>
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  const convert = async () => {
    setBusy(true)
    try {
      if (beforeConvert) {
        const ready = await beforeConvert()
        if (!ready) return
      }
      const result = await convertProposalToProjectAction(proposalId)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Moved to the project list')
      router.push(`/projects/${result.data.projectId}`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" className={className} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
          Move this to project list
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Move this to the project list?</AlertDialogTitle>
          <AlertDialogDescription>
            This creates a new approved project from the proposed name, address, and client details
            on this proposal. The quotation stays here and will also appear on that project. You
            cannot undo this from the proposal screen.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => void convert()}>Move to project list</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
