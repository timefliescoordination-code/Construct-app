"use client"

import { useState, useMemo, useEffect } from "react"
import { ProjectFilters, ProjectStatus } from "./project-filters"
import { ProjectTable, Project } from "./project-table"
import { isDbProjectStatus } from "@/lib/project-status"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Plus, Search, Download } from "lucide-react"
import Link from "next/link"
import { useProjects } from "@/lib/hooks/use-project-data"
import { isDatabaseSetupError } from "@/lib/supabase/db-errors"
import { AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/layout/page"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/hooks/use-auth"
import { canViewProjectFinancials } from "@/lib/permissions"

export function ProjectsContent() {
  const [activeFilter, setActiveFilter] = useState<ProjectStatus>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<keyof Project | null>(null)
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const { role, canManageProjects, isAdmin, isLoading: authLoading } = useAuth()
  const showCreateProject = canManageProjects || isAdmin
  const showFinancials = canViewProjectFinancials(role)
  
  const { projects: dbProjects, isLoading, error, mutate } = useProjects({
    includeArchived: true,
  })

  useEffect(() => {
    const imgs = Array.from(document.images).slice(0, 8).map((img) => ({
      src: img.currentSrc || img.src,
      naturalWidth: img.naturalWidth,
      clientWidth: img.clientWidth,
    }))
    const cssHrefs = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map((el) => (el as HTMLLinkElement).href.split("/").pop())
    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b15f8a'},body:JSON.stringify({sessionId:'b15f8a',runId:'post-fix',hypothesisId:'A',location:'components/projects/projects-content.tsx:mount',message:'projects page snapshot',data:{href:window.location.href,authLoading,isLoading,error:error instanceof Error?error.message:error?String(error):null,projectCount:dbProjects.length,stylesheetCount:document.styleSheets.length,cssHrefs,imgs},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [authLoading, isLoading, error, dbProjects.length])

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      // #region agent log
      fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b15f8a'},body:JSON.stringify({sessionId:'b15f8a',runId:'post-fix',hypothesisId:'D',location:'components/projects/projects-content.tsx:onError',message:'window error on projects',data:{message:event.message,filename:event.filename,href:window.location.href},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    }
    window.addEventListener("error", onError)
    return () => window.removeEventListener("error", onError)
  }, [])

  // Transform database projects to the format expected by ProjectTable
  const projects: Project[] = useMemo(() => {
    return dbProjects.map(p => ({
      id: p.id,
      projectName: p.name,
      clientName: p.client_name,
      projectType: "Construction", // Default type since not in DB
      budget: p.contract_value,
      spent: p.total_expenses,
      profitLoss: p.profit_loss,
      progress: p.progress,
      status: isDbProjectStatus(p.status) ? p.status : "active",
      idle: p.idle,
    }))
  }, [dbProjects])

  useEffect(() => {
    if (!showFinancials && activeFilter === "high-risk") {
      setActiveFilter("all")
    }
  }, [showFinancials, activeFilter])

  const filterCounts = useMemo(() => {
    const nonArchived = projects.filter((p) => p.status !== "archived")
    return {
      all: nonArchived.length,
      active: projects.filter((p) => p.status === "active").length,
      completed: projects.filter((p) => p.status === "completed").length,
      "on-hold": projects.filter((p) => p.status === "on-hold").length,
      pending: projects.filter((p) => p.status === "pending").length,
      archived: projects.filter((p) => p.status === "archived").length,
      "high-risk": nonArchived.filter((p) => p.profitLoss < 0).length,
    }
  }, [projects])

  const filteredAndSortedProjects = useMemo(() => {
    let result = [...projects]

    // Filter by status
    if (activeFilter === "all") {
      result = result.filter((p) => p.status !== "archived")
    } else if (activeFilter === "high-risk") {
      result = result.filter((p) => p.status !== "archived" && p.profitLoss < 0)
    } else {
      result = result.filter((p) => p.status === activeFilter)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (p) =>
          p.projectName.toLowerCase().includes(query) ||
          p.clientName.toLowerCase().includes(query) ||
          p.projectType.toLowerCase().includes(query)
      )
    }

    // Sort
    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc"
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal)
        }

        if (typeof aVal === "number" && typeof bVal === "number") {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal
        }

        return 0
      })
    }

    return result
  }, [projects, activeFilter, searchQuery, sortField, sortDirection])

  const handleSort = (field: keyof Project) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDirection("asc")
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Projects"
          description="Manage and track all your construction projects"
        />
        <div className="space-y-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      </div>
    )
  }

  if (error) {
    const needsSetup = isDatabaseSetupError(error)

    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Projects"
          description="Manage and track all your construction projects"
        >
          <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </Button>
        </PageHeader>

        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              {needsSetup ? "Database setup required" : "Failed to load projects"}
            </CardTitle>
            <CardDescription className="text-base text-foreground/80">
              {error.message}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void mutate()}>
              Try again
            </Button>
          </CardContent>
          {needsSetup && (
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>1. Open <code className="rounded bg-muted px-1">supabase/schema.sql</code> in Cursor</p>
              <p>2. Copy all the SQL (Ctrl+A, Ctrl+C)</p>
              <p>3. Paste into Supabase SQL Editor and click Run</p>
              <p>4. Refresh this page, then click New Project</p>
            </CardContent>
          )}
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Projects"
        description="Manage and track all your construction projects"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 border-border text-muted-foreground hover:text-foreground">
            <Download className="h-4 w-4" />
            Export
          </Button>
          {!authLoading && showCreateProject && (
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90" asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" />
                New Project
              </Link>
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Filters and Search */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <ProjectFilters
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          counts={filterCounts}
          excludeFilters={showFinancials ? [] : ["high-risk"]}
        />
        <div className="relative w-full lg:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredAndSortedProjects.length} of {projects.length} projects
      </div>

      {/* Table */}
      <ProjectTable
        projects={filteredAndSortedProjects}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onProjectArchived={() => void mutate()}
      />
    </div>
  )
}
