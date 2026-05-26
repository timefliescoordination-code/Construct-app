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
import { Plus, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { useAuth } from "@/lib/hooks/use-auth"
import type { ProjectWithDetails } from "@/lib/types/database"

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
}

export function AdditionalWorksTab({ projectId: propProjectId, project }: AdditionalWorksTabProps) {
  const params = useParams()
  const projectId = propProjectId || project?.id || (params?.id as string)
  const { canManageProjects } = useAuth()

  const [additionalWorks, setAdditionalWorks] = useState<AdditionalWorkRow[]>(() =>
    project
      ? project.additional_works.map((w) => ({
          id: w.id,
          description: w.description,
          amount: Number(w.amount),
          approval_status: w.approval_status,
          requested_date: w.requested_date,
          notes: w.notes,
        }))
      : [],
  )
  const [isLoading, setIsLoading] = useState(!project)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [requestedDate, setRequestedDate] = useState(format(new Date(), "yyyy-MM-dd"))

  useEffect(() => {
    if (project) {
      setAdditionalWorks(
        project.additional_works.map((w) => ({
          id: w.id,
          description: w.description,
          amount: Number(w.amount),
          approval_status: w.approval_status,
          requested_date: w.requested_date,
          notes: w.notes,
        })),
      )
      setIsLoading(false)
      return
    }
    fetchWorks()
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
        setAdditionalWorks(data || [])
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddWork = async () => {
    if (!projectId) return
    if (!description.trim() || !amount) {
      toast.error("Please enter description and amount")
      return
    }

    setIsSubmitting(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from("additional_works")
      .insert({
        project_id: projectId,
        description: description.trim(),
        amount: parseFloat(amount),
        requested_date: requestedDate,
        approval_status: "pending",
      })
      .select("id, description, amount, approval_status, requested_date, notes")
      .single()

    if (error) {
      toast.error(`Failed to add work: ${error.message}`)
    } else if (data) {
      setAdditionalWorks((prev) => [data, ...prev])
      toast.success("Additional work added")
      setDescription("")
      setAmount("")
      setRequestedDate(format(new Date(), "yyyy-MM-dd"))
      setIsAddDialogOpen(false)
    }
    setIsSubmitting(false)
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
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Additional Works</CardTitle>
          {canManageProjects && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Work
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
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
                  <div className="grid grid-cols-2 gap-4">
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
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddWork} disabled={isSubmitting}>
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
            <div className="rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {additionalWorks.map((work) => (
                    <TableRow key={work.id} className="border-border hover:bg-muted/50">
                      <TableCell className="font-medium max-w-[300px]">
                        {work.description}
                      </TableCell>
                      <TableCell className="font-medium">
                        ₹ {Number(work.amount).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(work.requested_date), "MMM dd, yyyy")}
                      </TableCell>
                      <TableCell>{getStatusBadge(work.approval_status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
