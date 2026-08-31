'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import {
  Archive,
  Copy,
  Eye,
  History,
  Loader2,
  Pencil,
  Share2,
  Ban,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProposalDocumentView } from '@/components/proposals/proposal-document'
import { ProposalStatusBadge } from '@/components/proposals/proposal-status-badge'
import { ShareProposalDialog } from '@/components/proposals/share-proposal-dialog'
import {
  archiveProposalAction,
  createProposalRevisionAction,
  shareProposalAction,
  withdrawProposalAction,
} from '@/lib/proposals/actions'
import { canCreateRevisionFromStatus, canEditProposalVersion, publicSharePath } from '@/lib/proposals/access'
import { PROPOSAL_METHOD_LABELS } from '@/lib/proposals/constants'
import type { ProposalDetail, ProposalVersionWithItems, PublicProposalDocument } from '@/lib/proposals/types'
import { formatINR } from '@/lib/currency'
import { useCompanyBranding } from '@/lib/hooks/use-company-branding'

function toDocument(
  proposal: ProposalDetail,
  version: ProposalVersionWithItems,
  companyName: string | null,
  logoUrl: string | null,
): PublicProposalDocument {
  return {
    proposal_number: proposal.proposal_number,
    title: version.title || proposal.title,
    version_number: version.version_number,
    method: version.method,
    proposal_date: version.proposal_date,
    valid_until: version.valid_until,
    project_name: version.snapshot_project_name,
    project_address: version.snapshot_project_address,
    client_name: version.snapshot_client_name,
    notes: version.notes,
    items: version.items.map((item) => ({
      sort_order: item.sort_order,
      section: item.section,
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unit: item.unit,
      rate: Number(item.rate) || 0,
      price: Number(item.price) || 0,
    })),
    built_up_total: Number(version.built_up_total) || 0,
    additional_works_total: Number(version.additional_works_total) || 0,
    grand_total: Number(version.grand_total) || 0,
    company: {
      company_name: companyName,
      phone: null,
      email: null,
      address: null,
      logo_url: logoUrl,
    },
  }
}

function historyStatus(proposal: ProposalDetail, version: ProposalVersionWithItems) {
  if (version.id !== proposal.current_version_id && version.shared_at) return 'superseded'
  return version.status
}

export function ProposalDetailContent({ proposal }: { proposal: ProposalDetail }) {
  const router = useRouter()
  const { branding } = useCompanyBranding()
  const [busy, setBusy] = useState(false)
  const [previewVersion, setPreviewVersion] = useState<ProposalVersionWithItems | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePath, setSharePath] = useState<string | null>(
    proposal.share_token ? publicSharePath(proposal.share_token) : null,
  )

  const current =
    proposal.versions.find((version) => version.id === proposal.current_version_id) ?? proposal.versions[0]
  const openRequests = proposal.revision_requests.filter((req) => req.status === 'open')
  const canEdit = current ? canEditProposalVersion(current.status, current.shared_at) : false
  const canRevise = current ? canCreateRevisionFromStatus(current.status, current.shared_at) : false

  const previewDoc = useMemo(() => {
    if (!previewVersion) return null
    return toDocument(proposal, previewVersion, branding.company_name, branding.logo_url)
  }, [previewVersion, proposal, branding])

  const copyLink = async () => {
    const token = proposal.share_token || current?.public_token
    if (!token) {
      toast.error('Share the proposal first to generate a public link.')
      return
    }
    const url = `${window.location.origin}${publicSharePath(token)}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Proposal link copied')
    } catch {
      toast.error('Could not copy the link.')
    }
  }

  const share = async () => {
    setBusy(true)
    try {
      const result = await shareProposalAction(proposal.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSharePath(result.data.shareUrlPath)
      setShareOpen(true)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const createRevision = async () => {
    setBusy(true)
    try {
      const result = await createProposalRevisionAction(proposal.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(`Version ${result.data.versionNumber} created as a draft.`)
      router.push(`/proposals/${proposal.id}/edit`)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async () => {
    setBusy(true)
    try {
      const result = await withdrawProposalAction(proposal.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Proposal withdrawn')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  const archive = async () => {
    setBusy(true)
    try {
      const result = await archiveProposalAction(proposal.id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Proposal archived')
      router.push('/proposals')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            <Link href="/proposals" className="hover:underline">
              Proposals
            </Link>
            {proposal.project ? (
              <>
                {' / '}
                <Link href={`/projects/${proposal.project.id}?tab=proposals`} className="hover:underline">
                  {proposal.project.name}
                </Link>
              </>
            ) : null}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {proposal.proposal_number}
            </h1>
            <ProposalStatusBadge status={proposal.status} />
          </div>
          <p className="text-muted-foreground">{proposal.title}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {canEdit ? (
            <Button variant="outline" className="gap-2" asChild>
              <Link href={`/proposals/${proposal.id}/edit`}>
                <Pencil className="h-4 w-4" />
                Edit draft
              </Link>
            </Button>
          ) : null}
          {current ? (
            <Button variant="outline" className="gap-2" onClick={() => setPreviewVersion(current)}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
          ) : null}
          {canEdit || proposal.share_token ? (
            <Button className="gap-2" onClick={() => void share()} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              {canEdit ? 'Share proposal' : 'Share'}
            </Button>
          ) : null}
          {proposal.share_token || current?.public_token ? (
            <Button variant="outline" className="gap-2" onClick={() => void copyLink()}>
              <Copy className="h-4 w-4" />
              Copy link
            </Button>
          ) : null}
          {canRevise ? (
            <Button variant="outline" className="gap-2" onClick={() => void createRevision()} disabled={busy}>
              <History className="h-4 w-4" />
              Create revision
            </Button>
          ) : null}
        </div>
      </div>

      {openRequests.length > 0 ? (
        <Alert className="border-amber-500/40 bg-amber-500/5">
          <AlertTitle>Revision requested</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-3">
              {openRequests.map((req) => {
                const version = proposal.versions.find((v) => v.id === req.proposal_version_id)
                return (
                  <div key={req.id} className="rounded-lg border border-amber-500/20 bg-background/60 p-3">
                    <p className="text-sm font-medium text-foreground">
                      {proposal.project?.client_name || 'Client'} · {proposal.proposal_number}
                      {version ? ` — Version ${version.version_number}` : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm">{req.client_message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(req.created_at), 'd MMM yyyy, h:mm a')}
                    </p>
                  </div>
                )
              })}
              {canRevise ? (
                <Button size="sm" onClick={() => void createRevision()} disabled={busy}>
                  Create revision
                </Button>
              ) : null}
            </div>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Current version</CardDescription>
            <CardTitle className="text-2xl">Version {current?.version_number ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>{current ? PROPOSAL_METHOD_LABELS[current.method] : '—'}</p>
            <p className="text-2xl font-semibold tabular-nums">{formatINR(Number(current?.grand_total ?? 0))}</p>
            {current?.first_viewed_at ? (
              <p className="text-muted-foreground">
                Last viewed {format(new Date(current.last_viewed_at || current.first_viewed_at), 'd MMM yyyy, h:mm a')}
              </p>
            ) : (
              <p className="text-muted-foreground">Not viewed</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Project</CardDescription>
            <CardTitle className="text-lg">{proposal.project?.name ?? '—'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm text-muted-foreground">
            <p>{proposal.project?.client_name || 'No client name'}</p>
            <p className="whitespace-pre-line">{proposal.project?.site_address || 'No address'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Created</CardDescription>
            <CardTitle className="text-lg">
              {format(new Date(proposal.created_at), 'd MMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {proposal.created_by_profile?.full_name || '—'}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proposal history</CardTitle>
          <CardDescription>Shared versions are kept as permanent commercial records.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {proposal.versions.map((version) => {
            const status = historyStatus(proposal, version)
            return (
              <div
                key={version.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">Version {version.version_number}</p>
                    <ProposalStatusBadge status={status} />
                    {version.id === proposal.current_version_id ? (
                      <span className="text-xs font-medium text-primary">Current</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatINR(Number(version.grand_total) || 0)}
                    {version.shared_at
                      ? ` · Shared ${format(new Date(version.shared_at), 'd MMM yyyy')}`
                      : ' · Draft'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewVersion(version)}>
                    View
                  </Button>
                  {version.id === proposal.current_version_id && canRevise ? (
                    <Button size="sm" variant="outline" onClick={() => void createRevision()} disabled={busy}>
                      Create revision
                    </Button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {proposal.status !== 'withdrawn' && proposal.status !== 'archived' ? (
          <Button variant="outline" className="gap-2 text-destructive" onClick={() => void withdraw()} disabled={busy}>
            <Ban className="h-4 w-4" />
            Withdraw
          </Button>
        ) : null}
        {proposal.status !== 'archived' ? (
          <Button variant="ghost" className="gap-2" onClick={() => void archive()} disabled={busy}>
            <Archive className="h-4 w-4" />
            Archive
          </Button>
        ) : null}
      </div>

      <Dialog open={Boolean(previewVersion)} onOpenChange={(open) => !open && setPreviewVersion(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {previewVersion ? `Version ${previewVersion.version_number}` : 'Preview'}
            </DialogTitle>
          </DialogHeader>
          {previewDoc ? <ProposalDocumentView document={previewDoc} /> : null}
        </DialogContent>
      </Dialog>

      <ShareProposalDialog open={shareOpen} onOpenChange={setShareOpen} sharePath={sharePath} />
    </div>
  )
}
