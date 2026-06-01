"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Plus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import type { AdditionalWorkStatus, ProjectWithDetails } from "@/lib/types/database"
import {
  createAdditionalWorkAction,
  deleteAdditionalWorkAction,
  updateAdditionalWorkAction,
  updateAdditionalWorkStatusAction,
} from "@/lib/projects/tab-actions"

interface AdditionalWorkRow {
  id: string
  description: string
  amount: number
  approval_status: string
  requested_date: string
  notes: string | null
}

interface AdditionalWorksTabProps {
  projectId?: string
  project?: ProjectWithDetails
  onProjectChange?: () => void
}

function mapWorkRow(w: {
  id: string
  description: string
  amount: number | string
  approval_status: string
  requested_date: string
  notes: string | null
}): AdditionalWorkRow {
  return {
    id: w.id,
    description: w.description,
    amount: Number(w.amount),
    approval_status: w.approval_status,
    requested_date: w.requested_date,
    notes: w.notes,
  }
}

export function AdditionalWorksTab({
  projectId: propProjectId,
  project,
  onProjectChange,
}: AdditionalWorksTabProps) {
  const params = useParams()
  const projectId = propProjectId || project?.id || (params?.id as string)
  const { canManageProjects } = useAuth()

  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWorkRow[]>(() =>
    project ? project.additional_works.map(mapWorkRow) : [],
  )
  const [isLoading, setIsLoading] = useState(!project)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingWork, setEditingWork] = useState<AdditionalWorkRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdditionalWorkRow | null>(null)

  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [requestedDate, setRequestedDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = useState("")

  const [editDescription, setEditDescription] = useState("")
  const [editAmount, setEditAmount] = useState("")
  const [editRequestedDate, setEditRequestedDate] = useState("")
  const [editNotes, setEditNotes] = useState("")

  useEffect(() => {
    if (project) {
      setAdditionalWorks(project.additional_works.map(mapWorkRow))
      setIsLoading(false)
      return
    }
    void fetchWorks()
  }, [projectId, project])

  async function fetchWorks() {
    if (!projectId) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("additional_works")
        .select("id, description, amount, approval_status, requested_date, notes")
        .eq("project_id", projectId)
        .order("requested_date", { ascending: false })

      if (error) {
        console.error("[additional-works] fetch error:", error)
        toast.error("Failed to load additional works")
      } else {
        setAdditionalWorks((data ?? []).map(mapWorkRow))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const applyWorkUpdate = (row: Record<string, unknown>) => {
    const updated = mapWorkRow(row as AdditionalWorkRow)
    setAdditionalWorks((prev) =>
      prev.map((w) => (w.id === updated.id ? updated : w)),
    )
    onProjectChange?.()
  }

  const handleAddWork = async () => {
    if (!projectId) return
    if (!description.trim() || !amount) {
      toast.error("Please enter description and amount")
      return
    }

    setIsSubmitting(true)
    const result = await createAdditionalWorkAction({
      projectId,
      description: description.trim(),
      amount: parseFloat(amount),
      requestedDate,
    })

    if (!result.ok) {
      toast.error(result.error)
    } else {
      setAdditionalWorks((prev) => [mapWorkRow(result.data as AdditionalWorkRow), ...prev])
      onProjectChange?.()
      toast.success("Additional work added")
      setDescription("")
      setAmount("")
      setNotes("")
      setRequestedDate(format(new Date(), "yyyy-MM-dd"))
      setIsAddDialogOpen(false)
    }
    setIsSubmitting(false)
  }

  const openEditDialog = (work: AdditionalWorkRow) => {
    setEditingWork(work)
    setEditDescription(work.description)
    setEditAmount(String(work.amount))
    setEditRequestedDate(work.requested_date)
    setEditNotes(work.notes ?? "")
    setIsEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!projectId || !editingWork) return
    if (!editDescription.trim() || !editAmount) {
      toast.error("Please enter description and amount")
      return
    }

    const parsedAmount = parseFloat(editAmount)
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error("Enter a valid amount")
      return
    }

    setIsSubmitting(true)
    const result = await updateAdditionalWorkAction({
      projectId,
      workId: editingWork.id,
      description: editDescription.trim(),
      amount: parsedAmount,
      requestedDate: editRequestedDate,
      notes: editNotes.trim() || null,
    })
    setIsSubmitting(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    applyWorkUpdate(result.data)
    toast.success("Additional work updated")
    setIsEditDialogOpen(false)
    setEditingWork(null)
  }

  const handleStatusChange = async (
    workId: string,
    status: AdditionalWorkStatus,
  ) => {
    if (!projectId) return

    setIsSubmitting(true)
    const result = await updateAdditionalWorkStatusAction({
      projectId,
      workId,
      approvalStatus: status,
    })
    setIsSubmitting(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    applyWorkUpdate(result.data)
    const label =
      status === "approved" ? "approved" : status === "rejected" ? "rejected" : "updated"
    toast.success(`Additional work ${label}`)
  }

  const handleDelete = async () => {
    if (!projectId || !deleteTarget) return

    setIsSubmitting(true)
    const result = await deleteAdditionalWorkAction({
      projectId,
      workId: deleteTarget.id,
    })
    setIsSubmitting(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    setAdditionalWorks((prev) => prev.filter((w) => w.id !== deleteTarget.id))
    onProjectChange?.()
    toast.success("Additional work deleted")
    setDeleteTarget(null)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Approved</Badge>
        )
      case "pending":
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">Pending</Badge>
        )
      case "rejected":
        return (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30">Rejected</Badge>
        )
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>Additional Works</CardTitle>
          {canManageProjects && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Add Work
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Additional Work</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe the additional work..."
                      className="bg-muted border-border"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Amount (₹)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        className="bg-muted border-border"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input
                        type="date"
                        className="bg-muted border-border"
                        value={requestedDate}
                        onChange={(e) => setRequestedDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => void handleAddWork()} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Add Work"
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {additionalWorks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No additional works recorded for this project yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="w-[45%]">Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageProjects && (
                      <TableHead className="w-16 text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {additionalWorks.map((work) => (
                    <TableRow key={work.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium align-top">
                        <p className="whitespace-pre-wrap break-words pr-2">{work.description}</p>
                        {work.notes ? (
                          <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words pr-2">
                            {work.notes}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-medium whitespace-nowrap">
                        ₹ {Number(work.amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(work.requested_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(work.approval_status)}</TableCell>
                      {canManageProjects && (
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                disabled={isSubmitting}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(work)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              {work.approval_status === "pending" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void handleStatusChange(work.id, "approved")
                                    }
                                  >
                                    <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      void handleStatusChange(work.id, "rejected")
                                    }
                                  >
                                    <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                    Reject
                                  </DropdownMenuItem>
                                </>
                              )}
                              {work.approval_status !== "pending" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    void handleStatusChange(work.id, "pending")
                                  }
                                >
                                  Reset to pending
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => setDeleteTarget(work)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isEditDialogOpen}
        onOpenChange={(open) => {
          setIsEditDialogOpen(open)
          if (!open) setEditingWork(null)
        }}
      >
        <DialogContent className="bg-card border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Additional Work</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                className="bg-muted border-border"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  className="bg-muted border-border"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  className="bg-muted border-border"
                  value={editRequestedDate}
                  onChange={(e) => setEditRequestedDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                className="bg-muted border-border"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Internal notes..."
              />
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete additional work?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.description}" will be removed permanently.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isSubmitting}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
