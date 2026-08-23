"use client"

import { useRef, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Image as ImageIcon, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { uploadSitePhotosAction } from "@/lib/site-photos/actions"
import { SitePhotosGallery } from "./site-photos-gallery"

interface PhotosTabProps {
  projectId?: string
  projectName?: string
  canUpload?: boolean
  customerMode?: boolean
}

export function PhotosTab({
  projectId: propProjectId,
  projectName: propProjectName,
  canUpload = false,
  customerMode = false,
}: PhotosTabProps = {}) {
  const params = useParams()
  const projectId = propProjectId || (params?.id as string)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [galleryRefreshKey, setGalleryRefreshKey] = useState(0)

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

      toast.success(`${result.data?.count ?? 0} site photo(s) uploaded`)
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
        <CardContent>
          <SitePhotosGallery
            projectId={projectId}
            customerMode={customerMode}
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
