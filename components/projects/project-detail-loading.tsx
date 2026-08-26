import { Loader2 } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { BrandLogo } from "@/components/layout/brand-logo"

export function ProjectDetailLoading({ message = "Loading project…" }: { message?: string }) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-4 py-5">
          <div className="flex items-center gap-3">
            <BrandLogo size={36} />
            <div className="min-w-0">
              <p className="text-sm font-bold">VRA HOMES</p>
              <p className="text-[11px] text-muted-foreground">Loading project</p>
            </div>
          </div>
        </div>
        <div className="space-y-2 p-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-xl" />
          ))}
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border px-4 py-6 md:px-6">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-4 h-8 w-64 max-w-full" />
          <Skeleton className="mt-3 h-4 w-48 max-w-full" />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-4 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  )
}
