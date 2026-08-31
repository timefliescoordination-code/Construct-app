'use client'

import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

export function ShareProposalDialog({
  open,
  onOpenChange,
  sharePath,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  sharePath: string | null
}) {
  const [copied, setCopied] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = sharePath ? `${origin}${sharePath}` : ''

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success('Proposal link copied')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Share proposal</DialogTitle>
          <DialogDescription>
            Send this secure link to the client. They can open it without logging in.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input readOnly value={url} />
          <Button type="button" className="shrink-0 gap-2" onClick={() => void copy()} disabled={!url}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            Copy link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
