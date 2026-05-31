"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import { ArrowUpDown, MoreHorizontal, TrendingDown, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import type { ProjectStatus as DbProjectStatus } from "@/lib/types/database"
import { PROJECT_STATUS_BADGE } from "@/lib/project-status"
import { formatINR } from "@/lib/currency"
import { useAuth } from "@/lib/hooks/use-auth"
import { canViewProjectFinancials } from "@/lib/permissions"
import { archiveProjectAction } from "@/lib/projects/actions"
import { toast } from "sonner"
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
import { Loader2 } from "lucide-react"

export interface Project {
  id: string
  projectName: string
  clientName: string
  projectType: string
  budget: number
  spent: number
  profitLoss: number
  progress: number
  status: DbProjectStatus
}

interface ProjectTableProps {
  projects: Project[]
  sortField: keyof Project | null
  sortDirection: "asc" | "desc"
  onSort: (field: keyof Project) => void
  onProjectArchived?: () => void
}

const formatCurrency = (amount: number) => {
  return formatINR(amount)
}

const getStatusBadge = (status: DbProjectStatus) => PROJECT_STATUS_BADGE[status]

export function ProjectTable({
  projects,
  sortField,
  sortDirection,
  onSort,
  onProjectArchived,
}: ProjectTableProps) {
  const router = useRouter()
  const { role, canManageProjects } = useAuth()
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null)
  const [isArchiving, setIsArchiving] = useState(false)

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return
    setIsArchiving(true)
    const result = await archiveProjectAction(archiveTarget.id)
    setIsArchiving(false)

    if (!result.ok) {
      toast.error(result.error)
      return
    }

    toast.success(`"${archiveTarget.projectName}" archived.`)
    setArchiveTarget(null)
    onProjectArchived?.()
    router.refresh()
  }
  const showFinancials = canViewProjectFinancials(role)
  const columnCount = showFinancials ? 9 : 6
  const SortableHeader = ({ field, children }: { field: keyof Project; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      onClick={() => onSort(field)}
      className="h-auto p-0 font-medium text-muted-foreground hover:text-foreground hover:bg-transparent"
    >
      {children}
      <ArrowUpDown className={cn(
        "ml-2 h-4 w-4",
        sortField === field && "text-primary"
      )} />
    </Button>
  )

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground">
              <SortableHeader field="projectName">Project Name</SortableHeader>
            </TableHead>
            <TableHead className="text-muted-foreground">
              <SortableHeader field="clientName">Client Name</SortableHeader>
            </TableHead>
            <TableHead className="text-muted-foreground">
              <SortableHeader field="projectType">Project Type</SortableHeader>
            </TableHead>
            {showFinancials && (
              <>
            <TableHead className="text-muted-foreground text-right">
              <SortableHeader field="budget">Budget</SortableHeader>
            </TableHead>
            <TableHead className="text-muted-foreground text-right">
              <SortableHeader field="spent">Spent</SortableHeader>
            </TableHead>
            <TableHead className="text-muted-foreground text-right">
              <SortableHeader field="profitLoss">Profit/Loss</SortableHeader>
            </TableHead>
              </>
            )}
            <TableHead className="text-muted-foreground">
              <SortableHeader field="progress">Progress %</SortableHeader>
            </TableHead>
            <TableHead className="text-muted-foreground">
              <SortableHeader field="status">Status</SortableHeader>
            </TableHead>
            <TableHead className="text-muted-foreground w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columnCount} className="h-32 text-center text-muted-foreground">
                No projects found matching your filters.
              </TableCell>
            </TableRow>
          ) : (
            projects.map((project) => {
              const statusBadge = getStatusBadge(project.status)
              const isProfitable = project.profitLoss >= 0

              return (
                <TableRow 
                  key={project.id} 
                  className="border-border hover:bg-muted/50 transition-colors"
                >
                  <TableCell className="font-medium text-foreground">
                    <Link 
                      href={`/projects/${project.id}`}
                      className="hover:text-primary hover:underline transition-colors"
                    >
                      {project.projectName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {project.clientName}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-secondary/50 text-secondary-foreground border-border">
                      {project.projectType}
                    </Badge>
                  </TableCell>
                  {showFinancials && (
                    <>
                  <TableCell className="text-right font-medium text-foreground">
                    {formatCurrency(project.budget)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatCurrency(project.spent)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className={cn(
                      "flex items-center justify-end gap-1 font-medium",
                      isProfitable ? "text-success" : "text-destructive"
                    )}>
                      {isProfitable ? (
                        <TrendingUp className="h-4 w-4" />
                      ) : (
                        <TrendingDown className="h-4 w-4" />
                      )}
                      {formatCurrency(Math.abs(project.profitLoss))}
                    </div>
                  </TableCell>
                    </>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={project.progress} 
                        className="h-2 w-20 bg-muted"
                      />
                      <span className="text-sm text-muted-foreground w-10">
                        {project.progress}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={cn("border", statusBadge.className)}
                    >
                      {statusBadge.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${project.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        {canManageProjects && (
                          <>
                        <DropdownMenuItem>Edit Project</DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href={`/projects/${project.id}?tab=payments`}>View Financials</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          disabled={project.status === "archived"}
                          onClick={() => setArchiveTarget(project)}
                        >
                          Archive Project
                        </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>

      <AlertDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isArchiving) setArchiveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive project?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget
                ? `"${archiveTarget.projectName}" will be hidden from the main project list. You can still find it under the Archived filter. Data is not deleted.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isArchiving}
              onClick={(event) => {
                event.preventDefault()
                void handleConfirmArchive()
              }}
            >
              {isArchiving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Archiving…
                </>
              ) : (
                "Archive"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
