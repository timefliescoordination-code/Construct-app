'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { ArrowLeft, Eye, Loader2, Save, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProposalItemsEditor } from '@/components/proposals/proposal-items-editor'
import { ProposalDocumentView } from '@/components/proposals/proposal-document'
import { ShareProposalDialog } from '@/components/proposals/share-proposal-dialog'
import { ConvertToProjectButton } from '@/components/proposals/convert-to-project-button'
import {
  createProposalAction,
  getProposalDefaultNotesAction,
  shareProposalAction,
  updateDraftProposalAction,
} from '@/lib/proposals/actions'
import {
  computeProposalLines,
  computeProposalTotals,
  toQuantity,
  validateProposalForShare,
} from '@/lib/proposals/calculations'
import { DEFAULT_PROPOSAL_NOTES, defaultUnitForSection, type ProposalMethod } from '@/lib/proposals/constants'
import type { ProposalDetail, ProposalItemDraft, PublicProposalDocument } from '@/lib/proposals/types'
import { formatINR } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { useCompanyBranding } from '@/lib/hooks/use-company-branding'

type ProposalEditorProps = {
  mode: 'create' | 'edit'
  proposal?: ProposalDetail | null
}

function versionToDrafts(proposal: ProposalDetail | null | undefined): ProposalItemDraft[] {
  const version = proposal?.versions.find((v) => v.id === proposal.current_version_id) ?? proposal?.versions[0]
  if (!version) return []
  return version.items.map((item) => ({
    id: item.id,
    section: item.section,
    description: item.description,
    quantity: String(item.quantity ?? ''),
    unit: item.unit,
    rate: String(item.rate ?? ''),
  }))
}

export function ProposalEditor({ mode, proposal }: ProposalEditorProps) {
  const router = useRouter()
  const { branding } = useCompanyBranding()
  const currentVersion =
    proposal?.versions.find((v) => v.id === proposal.current_version_id) ?? proposal?.versions[0]

  const [proposedProjectName, setProposedProjectName] = useState(
    proposal?.proposed_project_name || currentVersion?.snapshot_project_name || '',
  )
  const [proposedSiteAddress, setProposedSiteAddress] = useState(
    proposal?.proposed_site_address || currentVersion?.snapshot_project_address || '',
  )
  const [proposedClientName, setProposedClientName] = useState(
    proposal?.proposed_client_name || currentVersion?.snapshot_client_name || '',
  )
  const [proposedClientPhone, setProposedClientPhone] = useState(
    proposal?.proposed_client_phone || currentVersion?.snapshot_client_phone || '',
  )
  const [proposedClientEmail, setProposedClientEmail] = useState(
    proposal?.proposed_client_email || currentVersion?.snapshot_client_email || '',
  )
  const [title, setTitle] = useState(proposal?.title || currentVersion?.title || '')
  const [proposalDate, setProposalDate] = useState(
    currentVersion?.proposal_date || format(new Date(), 'yyyy-MM-dd'),
  )
  const [validUntil, setValidUntil] = useState(currentVersion?.valid_until || '')
  const [method, setMethod] = useState<ProposalMethod>(currentVersion?.method || 'sqft')
  const [notes, setNotes] = useState(currentVersion?.notes || '')
  const [items, setItems] = useState<ProposalItemDraft[]>(() => {
    const existing = versionToDrafts(proposal)
    if (existing.length) return existing
    return [
      { section: 'built_up', description: '', quantity: '', unit: defaultUnitForSection('built_up'), rate: '' },
    ]
  })
  const [saving, setSaving] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePath, setSharePath] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'create' || notes) return
    let cancelled = false
    void getProposalDefaultNotesAction().then((result) => {
      if (cancelled) return
      if (result.ok) setNotes(result.data.notes)
      else setNotes(DEFAULT_PROPOSAL_NOTES)
    })
    return () => {
      cancelled = true
    }
  }, [mode, notes])

  const computed = useMemo(() => {
    const lines = computeProposalLines(
      items
        .filter((item) => item.description.trim())
        .map((item, index) => ({
          section: item.section,
          description: item.description,
          quantity: toQuantity(item.quantity),
          unit: item.unit,
          rate: toQuantity(item.rate),
          sortOrder: index,
        })),
    )
    return { lines, totals: computeProposalTotals(method, lines) }
  }, [items, method])

  const toPayload = () => ({
    proposedProjectName,
    proposedSiteAddress,
    proposedClientName,
    proposedClientPhone,
    proposedClientEmail,
    title: title.trim() || `${proposedProjectName.trim() || 'Project'} proposal`,
    proposalDate,
    validUntil: validUntil || null,
    method,
    notes,
    items: items
      .filter((item) => item.description.trim())
      .map((item) => ({
        section: item.section,
        description: item.description.trim(),
        quantity: toQuantity(item.quantity),
        unit: item.unit.trim() || defaultUnitForSection(item.section),
        rate: toQuantity(item.rate),
      })),
  })

  const handleMethodChange = (next: ProposalMethod) => {
    if (currentVersion?.shared_at) {
      toast.error('Pricing method cannot be changed after a version is shared. Create a revision instead.')
      return
    }
    setMethod(next)
    if (next === 'sqft' && !items.some((item) => item.section === 'built_up' || item.section === 'additional')) {
      setItems([
        { section: 'built_up', description: '', quantity: '', unit: 'sqft', rate: '' },
      ])
    }
    if (next === 'boq' && !items.some((item) => item.section === 'boq')) {
      setItems([{ section: 'boq', description: '', quantity: '', unit: 'item', rate: '' }])
    }
  }

  const saveDraft = async (andStay = true) => {
    if (!proposedProjectName.trim()) {
      toast.error('Enter the proposed project name.')
      return null
    }
    setSaving(true)
    try {
      const payload = toPayload()
      const result =
        mode === 'edit' && proposal
          ? await updateDraftProposalAction(proposal.id, payload)
          : await createProposalAction(payload)
      if (!result.ok) {
        toast.error(result.error)
        return null
      }
      toast.success('Draft saved')
      if (mode === 'create') {
        router.replace(`/proposals/${result.data.id}/edit`)
        router.refresh()
      } else if (andStay) {
        router.refresh()
      }
      return 'id' in result.data ? result.data.id : proposal?.id ?? null
    } finally {
      setSaving(false)
    }
  }

  const handleShare = async () => {
    const error = validateProposalForShare({
      projectName: proposedProjectName,
      projectAddress: proposedSiteAddress,
      method,
      items: toPayload().items,
    })
    if (error) {
      toast.error(error)
      return
    }

    setSharing(true)
    try {
      let id = proposal?.id ?? null
      if (mode === 'create' || (currentVersion && !currentVersion.shared_at)) {
        id = await saveDraft(false)
      }
      if (!id) return
      const result = await shareProposalAction(id)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setSharePath(result.data.shareUrlPath)
      setShareOpen(true)
      router.refresh()
    } finally {
      setSharing(false)
    }
  }

  const previewDocument: PublicProposalDocument = {
    proposal_number: proposal?.proposal_number || 'DRAFT',
    title: title || 'Construction proposal',
    version_number: currentVersion?.version_number ?? 1,
    method,
    proposal_date: proposalDate,
    valid_until: validUntil || null,
    project_name: proposedProjectName.trim() || 'Untitled project',
    project_address: proposedSiteAddress.trim(),
    client_name: proposedClientName.trim(),
    notes,
    items: computed.lines.map((line) => ({
      sort_order: line.sortOrder,
      section: line.section,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      rate: line.rate,
      price: line.price,
    })),
    built_up_total: computed.totals.builtUpTotal,
    additional_works_total: computed.totals.additionalWorksTotal,
    grand_total: computed.totals.grandTotal,
    company: {
      company_name: branding.company_name,
      phone: null,
      email: null,
      address: null,
      logo_url: branding.logo_url,
    },
  }

  const methodLocked = Boolean(currentVersion?.shared_at)

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2" asChild>
            <Link href={proposal ? `/proposals/${proposal.id}` : '/proposals'}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {mode === 'create' ? 'Create proposal' : `Edit ${proposal?.proposal_number ?? 'proposal'}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            Enter proposed project details here. This is not added to the project list until you move
            it.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Proposed project</CardTitle>
          <CardDescription>
            These details belong to this proposal only. A real project is created when someone clicks
            “Move this to project list”.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {proposal?.project_id && proposal.project ? (
            <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm sm:col-span-2">
              This proposal is on the project list as{' '}
              <Link href={`/projects/${proposal.project.id}`} className="font-medium hover:underline">
                {proposal.project.name}
              </Link>
              .
            </div>
          ) : null}
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="proposed-project-name">Proposed project name</Label>
            <Input
              id="proposed-project-name"
              value={proposedProjectName}
              onChange={(e) => setProposedProjectName(e.target.value)}
              placeholder="e.g. Sharma residence, Anna Nagar"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="proposed-project-address">Project address</Label>
            <Textarea
              id="proposed-project-address"
              rows={3}
              value={proposedSiteAddress}
              onChange={(e) => setProposedSiteAddress(e.target.value)}
              placeholder="Site address required before sharing"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposed-client-name">Client name</Label>
            <Input
              id="proposed-client-name"
              value={proposedClientName}
              onChange={(e) => setProposedClientName(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposed-client-phone">Client phone</Label>
            <Input
              id="proposed-client-phone"
              value={proposedClientPhone}
              onChange={(e) => setProposedClientPhone(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="proposed-client-email">Client email</Label>
            <Input
              id="proposed-client-email"
              type="email"
              value={proposedClientEmail}
              onChange={(e) => setProposedClientEmail(e.target.value)}
              placeholder="Optional"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proposal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="proposal-title">Title</Label>
            <Input
              id="proposal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Construction proposal"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposal-date">Proposal date</Label>
            <Input
              id="proposal-date"
              type="date"
              value={proposalDate}
              onChange={(e) => setProposalDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proposal-valid">Valid until (optional)</Label>
            <Input
              id="proposal-valid"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
          <div className="space-y-3 sm:col-span-2">
            <Label>Pricing method</Label>
            <RadioGroup
              value={method}
              onValueChange={(value) => handleMethodChange(value as ProposalMethod)}
              className="grid gap-3 sm:grid-cols-2"
              disabled={methodLocked}
            >
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-4',
                  method === 'sqft' ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <RadioGroupItem value="sqft" id="method-sqft" />
                <div>
                  <p className="font-medium">Sqft Method</p>
                  <p className="text-sm text-muted-foreground">Built-up area plus additional works.</p>
                </div>
              </label>
              <label
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-xl border p-4',
                  method === 'boq' ? 'border-primary bg-primary/5' : 'border-border',
                )}
              >
                <RadioGroupItem value="boq" id="method-boq" />
                <div>
                  <p className="font-medium">BOQ Method</p>
                  <p className="text-sm text-muted-foreground">Itemised bill of quantities.</p>
                </div>
              </label>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {method === 'sqft' ? (
        <>
          <ProposalItemsEditor
            section="built_up"
            title="As per built-up area"
            items={items}
            onChange={setItems}
            emptyHint="Example: Construction — 1,800 sqft × ₹2,100"
          />
          <ProposalItemsEditor
            section="additional"
            title="Additional works"
            items={items}
            onChange={setItems}
            emptyHint="Optional. Add compound wall, gate, AC provisions, or any other work."
          />
        </>
      ) : (
        <ProposalItemsEditor
          section="boq"
          title="BOQ"
          items={items}
          onChange={setItems}
          emptyHint="Upload an Excel or CSV file, or add each measurable item with quantity, unit, and rate."
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>These notes are stored with this version only.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:pl-64">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Total proposal value
            </p>
            <p className="text-2xl font-semibold tabular-nums">{formatINR(computed.totals.grandTotal)}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="gap-2" onClick={() => void saveDraft()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setPreviewOpen(true)}>
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            {mode === 'edit' && proposal && !proposal.project_id ? (
              <ConvertToProjectButton
                proposalId={proposal.id}
                className="gap-2"
                beforeConvert={async () => Boolean(await saveDraft(false))}
              />
            ) : null}
            <Button className="gap-2" onClick={() => void handleShare()} disabled={sharing}>
              {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
              Share proposal
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Proposal preview</DialogTitle>
          </DialogHeader>
          <ProposalDocumentView document={previewDocument} />
        </DialogContent>
      </Dialog>

      <ShareProposalDialog open={shareOpen} onOpenChange={setShareOpen} sharePath={sharePath} />
    </div>
  )
}
