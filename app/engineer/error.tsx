"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function EngineerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[engineer]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-semibold">Site dashboard could not load</h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Something went wrong while loading your assigned projects."}
        </p>
      </div>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
