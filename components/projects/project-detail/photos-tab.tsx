"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Image as ImageIcon, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { uploadSitePhotosAction } from "@/lib/site-photos/actions"
import { SitePhotosGallery } from "./site-photos-gallery"

interface PhotosTabProps {
  projectId?: string
  projectName?: string
  canUpload?: boolean
  customerMode?: boolean
  milestones?: Array<{ id: string; name: string }>
}

export function PhotosTab({
  projectId: propProjectId,
  projectName: propProjectName,
  canUpload = false,
  customerMode = false,
  milestones = [],
}: PhotosTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || (params?.id as string)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0)
  const [currentStageLabel, setCurrentStageLabel] = useState<string | null>(null)
  const [stageLoading, setStageLoading] = useState(false)

  const loadStageContext = useCallback(async () => {
    if (!projectId) return
    setStageLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/site-photos/stage`, {
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json()
      if (res.ok) {
        setCurrentStageLabel(json.data?.stageLabel ?? null)
      }
    } catch {
      setCurrentStageLabel(null)
    } finally {
      setStageLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void loadStageContext()
  }, [loadStageContext, galleryRefreshKey])

  const handleUpload = async (fileList: FileList | null) => {
    if (!projectId || !fileList?.length) return

    const files = Array.from(fileList)
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.set("projectId", projectId)
      for (const file of files) {
        formData.append("files", file)
      }

      setUploadProgress(15)
      const result = await uploadSitePhotosAction(formData)
      setUploadProgress(100)

      if (!result.ok) {
        toast.error(result.error)
        return
      }

      const stageNote = result.data?.stageLabel
        ? ` (${result.data.stageLabel})`
        : ""
      toast.success(`${result.data?.count ?? 0} site photo(s) uploaded${stageNote}`)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setGalleryRefreshKey((key) => key + 1)
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  if (!projectId) {
    return null
  }

  return (
    <div className="space-y-6">
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Site Photos
            {propProjectName && (
              <span className="text-sm font-normal text-muted-foreground">
                — {propProjectName}
              </span>
            )}
          </CardTitle>
          {canUpload && (
            <div className="flex flex-col items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => void handleUpload(e.target.files)}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Upload photos
              </Button>
              {isUploading && (
                <div className="w-full min-w-[12rem] space-y-1">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-[10px] text-muted-foreground text-right">
                    Processing and uploading…
                  </p>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {canUpload && (
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5">
              <p className="text-xs text-muted-foreground">Current construction stage</p>
              <div className="mt-1 flex items-center gap-2">
                {stageLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : currentStageLabel ? (
                  <Badge variant="secondary" className="text-sm font-medium">
                    {currentStageLabel}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    No stage from expenses yet — add an expense with a milestone first.
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                New uploads are tagged with the latest milestone from project expenses.
              </p>
            </div>
          )}
          <SitePhotosGallery
            projectId={projectId}
            customerMode={customerMode}
            canManage={canUpload && !customerMode}
            milestones={milestones}
            refreshKey={galleryRefreshKey}
            emptyMessage={
              canUpload
                ? "No site photos yet. Upload images to share progress with your customer."
                : "Site photos will appear here as the project progresses."
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
