"use client"

import { useCallback, useEffect, useState } from "react"
import { format } from "date-fns"
import {
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Loader2,
  MessageSquare,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { addDesignCommentAction } from "@/lib/design/actions"
import { isWatermarkableImageMime } from "@/lib/design/validate"
import type { ProjectDesignFileWithComments } from "@/lib/types/database"
import { profileNameForClientAutofill } from "@/lib/staff-labels"

interface CustomerDesignPanelProps {
  projectId: string
  initialDesignFileId?: string | null
}

export function CustomerDesignPanel({
  projectId,
  initialDesignFileId = null,
}: CustomerDesignPanelProps) {
  const [files, setFiles] = useState<ProjectDesignFileWithComments[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null)
  const [commentBody, setCommentBody] = useState("")
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)

  const loadFiles = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/design-files`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load drawings")
      setFiles(json.data ?? [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load drawings")
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadFiles()
  }, [loadFiles])

  const selected = files.find((f) => f.id === selectedFileId) ?? files[0] ?? null

  useEffect(() => {
    if (files.length === 0) return
    if (initialDesignFileId && files.some((f) => f.id === initialDesignFileId)) {
      setSelectedFileId(initialDesignFileId)
      return
    }
    if (!selectedFileId) {
      setSelectedFileId(files[0].id)
    }
  }, [files, selectedFileId, initialDesignFileId])

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

  const downloadWatermarked = (fileId: string) => {
    window.open(
      `/api/projects/${projectId}/design-files/${fileId}/download`,
      "_blank",
      "noopener,noreferrer",
    )
  }

  const handleComment = async () => {
    if (!selected || !commentBody.trim()) return
    setIsSubmittingComment(true)
    const result = await addDesignCommentAction(projectId, selected.id, commentBody)
    setIsSubmittingComment(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setCommentBody("")
    toast.success("Comment posted")
    await loadFiles()
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-16 text-center">
          <FileImage className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="font-medium text-muted-foreground">No design drawings yet</p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Your project manager will upload plans here for your review and comments.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="space-y-2">
        {files.map((file) => (
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
            {file.file_mime_type.startsWith("image/") ? (
              <FileImage className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            ) : (
              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.title || file.file_name}</p>
              {file.revision_label && (
                <p className="text-xs text-muted-foreground">{file.revision_label}</p>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>{selected.title || selected.file_name}</CardTitle>
            <CardDescription>
              {selected.revision_label && `${selected.revision_label} · `}
              {format(new Date(selected.created_at), "dd MMM yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => openPreview(selected.id)}>
                <ExternalLink className="h-4 w-4" />
                View
              </Button>
              {isWatermarkableImageMime(selected.file_mime_type) && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => downloadWatermarked(selected.id)}
                >
                  <Download className="h-4 w-4" />
                  Download (watermarked)
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="h-4 w-4" />
              Comments
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
              {selected.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Be the first to leave feedback.</p>
              ) : (
                selected.comments.map((c) => (
                  <div key={c.id} className="rounded-md bg-muted/50 p-2">
                    <p className="text-xs text-muted-foreground">
                      {c.author ? profileNameForClientAutofill(c.author) : "User"} ·{" "}
                      {format(new Date(c.created_at), "dd MMM yyyy")}
                    </p>
                    <p className="mt-1 text-sm">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="customer-design-comment">Your comment</Label>
              <Textarea
                id="customer-design-comment"
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                placeholder="Share your feedback on this drawing…"
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
