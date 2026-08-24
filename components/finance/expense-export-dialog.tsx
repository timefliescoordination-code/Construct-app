'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatINR } from '@/lib/currency'
import { buildExportSearchParams } from '@/lib/expense/export/filters'
import type { ExpenseExportFilters } from '@/lib/expense/export/types'

type ProjectOption = { id: string; name: string }
type ProfileOption = { id: string; full_name: string | null }

type ExpenseExportDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
  lockProject?: boolean
}

export function ExpenseExportDialog({
  open,
  onOpenChange,
  defaultProjectId,
  lockProject = false,
}: ExpenseExportDialogProps) {
  const [allExpenses, setAllExpenses] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [projectId, setProjectId] = useState(defaultProjectId ?? '')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [vendor, setVendor] = useState('')
  const [paymentStatus, setPaymentStatus] = useState('all')
  const [expenseType, setExpenseType] = useState<'all' | 'project' | 'company' | 'personal'>('all')
  const [createdBy, setCreatedBy] = useState('all')
  const [projects, setProjects] = useState<ProjectOption[]>([])
  const [profiles, setProfiles] = useState<ProfileOption[]>([])
  const [canExportCompany, setCanExportCompany] = useState(false)
  const [canExportPersonal, setCanExportPersonal] = useState(false)
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewTotal, setPreviewTotal] = useState<number | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<'xlsx' | 'pdf' | null>(null)

  useEffect(() => {
    if (defaultProjectId) setProjectId(defaultProjectId)
  }, [defaultProjectId])

  useEffect(() => {
    if (!open) return
    const params = new URLSearchParams()
    if (defaultProjectId) params.set('projectId', defaultProjectId)
    fetch(`/api/expenses/export/options?${params.toString()}`)
      .then((res) => res.json())
      .then((body) => {
        setProjects(body.projects ?? [])
        setProfiles(body.profiles ?? [])
        setCanExportCompany(Boolean(body.canExportCompany))
        setCanExportPersonal(Boolean(body.canExportPersonal))
      })
      .catch(() => toast.error('Failed to load export options'))
  }, [open, defaultProjectId])

  const filters = useMemo<ExpenseExportFilters>(
    () => ({
      allExpenses,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      projectId: projectId || undefined,
      category: category || undefined,
      subcategory: subcategory || undefined,
      vendor: vendor || undefined,
      paymentStatus: paymentStatus === 'all' ? undefined : paymentStatus,
      expenseType,
      createdBy: createdBy === 'all' ? undefined : createdBy,
    }),
    [
      allExpenses,
      dateFrom,
      dateTo,
      projectId,
      category,
      subcategory,
      vendor,
      paymentStatus,
      expenseType,
      createdBy,
    ],
  )

  const refreshPreview = useCallback(async () => {
    setPreviewLoading(true)
    try {
      const params = buildExportSearchParams(filters, 'xlsx')
      const res = await fetch(`/api/expenses/export/preview?${params.toString()}`)
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? 'Preview failed')
      setPreviewCount(body.count)
      setPreviewTotal(body.totalAmount)
    } catch (error) {
      setPreviewCount(null)
      setPreviewTotal(null)
      toast.error(error instanceof Error ? error.message : 'Failed to load preview')
    } finally {
      setPreviewLoading(false)
    }
  }, [filters])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => {
      void refreshPreview()
    }, 300)
    return () => clearTimeout(timer)
  }, [open, refreshPreview])

  const handleExport = async (format: 'xlsx' | 'pdf') => {
    setExportingFormat(format)
    try {
      const params = buildExportSearchParams(filters, format)
      const res = await fetch(`/api/expenses/export?${params.toString()}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Export failed')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename =
        match?.[1] ??
        `expenses-${format === 'pdf' ? 'report' : 'export'}-${format(new Date(), 'yyyy-MM-dd')}.${format}`
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} export downloaded`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export expenses</DialogTitle>
          <DialogDescription>
            Download authorized expenses as Excel or PDF. Large exports are generated on the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <p className="text-sm font-medium">All expenses</p>
              <p className="text-xs text-muted-foreground">
                Export every expense you are authorized to view, without filters.
              </p>
            </div>
            <Switch checked={allExpenses} onCheckedChange={setAllExpenses} />
          </div>

          {!allExpenses ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Date from</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </div>
              <div>
                <Label>Date to</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>
              <div>
                <Label>Project</Label>
                <Select
                  value={projectId || 'all'}
                  onValueChange={(v) => setProjectId(v === 'all' ? '' : v)}
                  disabled={lockProject && Boolean(defaultProjectId)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All projects" />
                  </SelectTrigger>
                  <SelectContent>
                    {!lockProject ? <SelectItem value="all">All projects</SelectItem> : null}
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expense type</Label>
                <Select
                  value={expenseType}
                  onValueChange={(v) =>
                    setExpenseType(v as 'all' | 'project' | 'company' | 'personal')
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    <SelectItem value="project">Project</SelectItem>
                    {canExportCompany ? <SelectItem value="company">Company</SelectItem> : null}
                    {canExportPersonal ? <SelectItem value="personal">Personal</SelectItem> : null}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Input value={category} onChange={(e) => setCategory(e.target.value)} />
              </div>
              <div>
                <Label>Subcategory</Label>
                <Input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} />
              </div>
              <div>
                <Label>Vendor / payee</Label>
                <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
              </div>
              <div>
                <Label>Payment status</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Created by</Label>
                <Select value={createdBy} onValueChange={setCreatedBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Anyone</SelectItem>
                    {profiles.map((profile) => (
                      <SelectItem key={profile.id} value={profile.id}>
                        {profile.full_name ?? profile.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
            {previewLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Calculating export preview…
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <strong>{previewCount ?? 0}</strong> records
                </span>
                <span className="font-semibold tabular-nums">
                  Total: {formatINR(previewTotal ?? 0)}
                </span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => void refreshPreview()} disabled={previewLoading}>
            Refresh preview
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleExport('xlsx')}
              disabled={exportingFormat !== null || previewLoading}
            >
              {exportingFormat === 'xlsx' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Excel
            </Button>
            <Button
              type="button"
              onClick={() => void handleExport('pdf')}
              disabled={exportingFormat !== null || previewLoading}
            >
              {exportingFormat === 'pdf' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ExpenseExportButton({
  defaultProjectId,
  lockProject,
  variant = 'outline',
}: {
  defaultProjectId?: string
  lockProject?: boolean
  variant?: 'default' | 'outline' | 'secondary'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant={variant} className="gap-2" onClick={() => setOpen(true)}>
        <Download className="h-4 w-4" />
        Export expenses
      </Button>
      <ExpenseExportDialog
        open={open}
        onOpenChange={setOpen}
        defaultProjectId={defaultProjectId}
        lockProject={lockProject}
      />
    </>
  )
}
