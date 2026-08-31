'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MAX_CLIENT_MESSAGE_LENGTH } from '@/lib/proposals/constants'

export function RequestRevisionDialog({
  open,
  onOpenChange,
  token,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  token: string
}) {
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/proposals/${encodeURIComponent(token)}/revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Could not send your request.')
        return
      }
      setSubmitted(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setMessage('')
          setSubmitted(false)
          setError(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request revision</DialogTitle>
          <DialogDescription>Tell us what you’d like us to change.</DialogDescription>
        </DialogHeader>
        {submitted ? (
          <p className="text-sm leading-relaxed">
            Your revision request has been sent to VRA Homes.
          </p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="revision-message">What should we change?</Label>
            <Textarea
              id="revision-message"
              rows={6}
              maxLength={MAX_CLIENT_MESSAGE_LENGTH}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please remove the compound wall and add AC provisions."
            />
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DialogFooter>
          {submitted ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void submit()} disabled={submitting || !message.trim()}>
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Submit revision request
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
