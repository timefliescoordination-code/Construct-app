"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { format } from "date-fns"
import {
  Upload,
  Loader2,
  Trash2,
  MessageSquare,
  FileImage,
  FileText,
  Hammer,
  ExternalLink,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { toast } from "sonner"
import {
  uploadDesignFileAction,
  deleteDesignFileAction,
  addDesignCommentAction,
} from "@/lib/design/actions"
import { activateConstructionPhaseAction } from "@/lib/projects/actions"
import { isConstructionActive } from "@/lib/projects/lifecycle"
import { isWatermarkableImageMime } from "@/lib/design/validate"
import type { ProjectDesignFileWithComments, ProjectLifecyclePhase } from "@/lib/types/database"
import { profileNameForClientAutofill } from "@/lib/staff-labels"

interface DesignTabProps {
  projectId: string
  projectName: string
  lifecyclePhase: ProjectLifecyclePhase
  canManageProjects: boolean
  onProjectChange?: () => void
}

export function DesignTab({
  projectId,
  projectName,
  lifecyclePhase,
  canManageProjects,
  onProjectChange,
}: DesignTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<ProjectDesignFileWithComments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [title, setTitle] = useState("")
  const [revisionLabel, setRevisionLabel] = useState("")
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [activateOpen, setActivateOpen] = useState(false)
  const [isActivating, setIsActivating] = useState(false)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/design-files`)
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to load design files")
      }
      setFiles(json.data ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load design files")
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    const formData = new FormData()
    formData.set("projectId", projectId)
    formData.set("file", file)
    if (title.trim()) formData.set("title", title.trim())
    if (revisionLabel.trim()) formData.set("revisionLabel", revisionLabel.trim())

    const result = await uploadDesignFileAction(formData)
    setIsUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ""

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success("Design file uploaded")
    setTitle("")
    setRevisionLabel("")
    await loadFiles()
    onProjectChange?.()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const result = await deleteDesignFileAction(projectId, deleteTarget)
    setDeleteTarget(null)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Design file removed")
    if (selectedFileId === deleteTarget) setSelectedFileId(null)
    await loadFiles()
    onProjectChange?.()
  }

  const handleComment = async () => {
    if (!selectedFileId || !commentBody.trim()) return
    setIsSubmittingComment(true)
    const result = await addDesignCommentAction(projectId, selectedFileId, commentBody)
    setIsSubmittingComment(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setCommentBody("")
    toast.success("Comment added")
    await loadFiles()
  }

  const handleActivateConstruction = async () => {
    setIsActivating(true)
    const result = await activateConstructionPhaseAction(projectId)
    setIsActivating(false)
    setActivateOpen(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.success("Construction phase activated")
    onProjectChange?.()
  }

  const openPreview = async (fileId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/design-files/${fileId}/view`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to open file")
      window.open(json.data.url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open file")
    }
  }

  const selected = files.find((f) => f.id === selectedFileId) ?? files[0] ?? null

  useEffect(() => {
    if (files.length > 0 && !selectedFileId) {
      setSelectedFileId(files[0].id)
    }
  }, [files, selectedFileId])

  const inDesignPhase = !isConstructionActive({ lifecycle_phase: lifecyclePhase })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Design drawings</h2>
          <p className="text-sm text-muted-foreground">
            Upload drawings for {projectName}. Customers can view, comment, and download watermarked images.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={inDesignPhase ? "secondary" : "default"}>
            {inDesignPhase ? "Design phase" : "Construction phase"}
          </Badge>
          {canManageProjects && inDesignPhase && (
            <Button className="gap-2" onClick={() => setActivateOpen(true)}>
              <Hammer className="h-4 w-4" />
              Activate construction
            </Button>
          )}
        </div>
      </div>

      {canManageProjects && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload drawing</CardTitle>
            <CardDescription>PDF, PNG, JPEG, or WebP up to 20MB</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="design-title">Title (optional)</Label>
                <Input
                  id="design-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ground floor plan"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="design-revision">Revision (optional)</Label>
                <Input
                  id="design-revision"
                  value={revisionLabel}
                  onChange={(e) => setRevisionLabel(e.target.value)}
                  placeholder="Rev A"
                />
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,image/*,application/pdf"
              className="hidden"
              onChange={handleUpload}
            />
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              Choose file
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center">
            <FileImage className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium text-muted-foreground">No design files yet</p>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              {canManageProjects
                ? "Upload the first drawing so your customer can review it in their portal."
                : "Drawings will appear here once your project manager uploads them."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-2">
            {files.map((file) => {
              const isImage = file.file_mime_type.startsWith("image/")
              return (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedFileId(file.id)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selected?.id === file.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  {isImage ? (
                    <FileImage className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.title || file.file_name}</p>
                    {file.revision_label && (
                      <p className="text-xs text-muted-foreground">{file.revision_label}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(file.created_at), "dd MMM yyyy")}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>

          {selected && (
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{selected.title || selected.file_name}</CardTitle>
                  <CardDescription>
                    {selected.revision_label && `${selected.revision_label} · `}
                    Uploaded {format(new Date(selected.created_at), "dd MMM yyyy")}
                    {selected.uploader &&
                      ` · ${profileNameForClientAutofill(selected.uploader)}`}
                  </CardDescription>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" size="sm" className="gap-1" onClick={() => openPreview(selected.id)}>
                    <ExternalLink className="h-4 w-4" />
                    View
                  </Button>
                  {canManageProjects && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-destructive"
                      onClick={() => setDeleteTarget(selected.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4" />
                  {selected.comments.length} comment
                  {selected.comments.length === 1 ? "" : "s"}
                </div>

                <div className="max-h-64 space-y-3 overflow-y-auto rounded-lg border border-border p-3">
                  {selected.comments.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No comments yet.</p>
                  ) : (
                    selected.comments.map((comment) => (
                      <div key={comment.id} className="rounded-md bg-muted/50 p-3">
                        <p className="text-xs font-medium text-muted-foreground">
                          {comment.author
                            ? profileNameForClientAutofill(comment.author)
                            : "User"}{" "}
                          · {format(new Date(comment.created_at), "dd MMM yyyy HH:mm")}
                        </p>
                        <p className="mt-1 text-sm">{comment.body}</p>
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="design-comment">Add a comment</Label>
                  <Textarea
                    id="design-comment"
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder="Share feedback on this drawing…"
                    rows={3}
                  />
                  <Button
                    size="sm"
                    disabled={isSubmittingComment || !commentBody.trim()}
                    onClick={() => void handleComment()}
                  >
                    {isSubmittingComment ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Post comment"
                    )}
                  </Button>
                </div>

                {isWatermarkableImageMime(selected.file_mime_type) && (
                  <p className="text-xs text-muted-foreground">
                    Customers can download this file with a company watermark from their portal.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete design file?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the file and all comments. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={activateOpen} onOpenChange={setActivateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Activate construction phase?</AlertDialogTitle>
            <AlertDialogDescription>
              This creates default construction milestones and enables live financial tracking
              for the customer portal. Design files remain available.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isActivating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isActivating}
              onClick={(e) => {
                e.preventDefault()
                void handleActivateConstruction()
              }}
            >
              {isActivating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate construction"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
