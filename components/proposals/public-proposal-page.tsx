'use client'

import { useEffect, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProposalDocumentView } from '@/components/proposals/proposal-document'
import { RequestRevisionDialog } from '@/components/proposals/request-revision-dialog'
import { downloadProposalPdf } from '@/lib/proposals/pdf'
import type { PublicProposalResponse } from '@/lib/proposals/types'
import Link from 'next/link'

const UNAVAILABLE: Record<Exclude<PublicProposalResponse['availability'], 'ok'>, { title: string; body: string }> = {
  unavailable: {
    title: 'Proposal unavailable',
    body: 'This proposal link is invalid or no longer available.',
  },
  withdrawn: {
    title: 'Proposal withdrawn',
    body: 'This proposal is no longer active.',
  },
  expired: {
    title: 'Proposal expired',
    body: 'This proposal is no longer valid.',
  },
}

export function PublicProposalPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicProposalResponse | null>(null)
  const [revisionOpen, setRevisionOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/public/proposals/${encodeURIComponent(token)}`, {
          cache: 'no-store',
        })
        const json = (await res.json()) as PublicProposalResponse
        if (!cancelled) setData(json)
      } catch {
        if (!cancelled) {
          setData({
            availability: 'unavailable',
            is_historical: false,
            newer_available: false,
            current_share_path: null,
            can_request_revision: false,
            document: null,
          })
        }
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [token])

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-neutral-500">
        Loading proposal…
      </div>
    )
  }

  if (data.availability !== 'ok' || !data.document) {
    const copy = UNAVAILABLE[data.availability === 'ok' ? 'unavailable' : data.availability]
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
        <div className="max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">VRA HOMES</p>
          <h1 className="mt-4 text-2xl font-semibold text-neutral-900">{copy.title}</h1>
          <p className="mt-2 text-neutral-600">{copy.body}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 text-neutral-900">
      <div className="print:hidden mx-auto flex w-full max-w-3xl items-center justify-end gap-2 px-4 py-4">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-white"
          onClick={() => data.document && downloadProposalPdf(data.document)}
        >
          <Download className="h-4 w-4" />
          Download PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-2 bg-white" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
          Print
        </Button>
      </div>

      <div className="mx-auto max-w-3xl px-4 pb-16">
        <div
          id="proposal-print-root"
          className="rounded-none bg-white px-5 py-8 shadow-sm sm:rounded-3xl sm:px-10 sm:py-12"
        >
          <ProposalDocumentView
            document={data.document}
            historicalBanner={
              data.is_historical ? (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  This is a previous version of this proposal.
                  {data.current_share_path ? (
                    <>
                      {' '}
                      <Link href={data.current_share_path} className="font-medium underline">
                        View the current proposal
                      </Link>
                    </>
                  ) : null}
                </div>
              ) : null
            }
          />

          {data.can_request_revision ? (
            <section className="mt-12 border-t border-neutral-200 pt-8 print:hidden">
              <h2 className="text-lg font-semibold">Request revision</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Would you like us to make changes to this proposal?
              </p>
              <Button className="mt-4" onClick={() => setRevisionOpen(true)}>
                Request revision
              </Button>
            </section>
          ) : null}
        </div>
      </div>

      <RequestRevisionDialog open={revisionOpen} onOpenChange={setRevisionOpen} token={token} />
    </div>
  )
}
