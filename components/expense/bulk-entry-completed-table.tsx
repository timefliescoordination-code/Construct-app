"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatINR } from "@/lib/currency"
import type {
  BulkEntryVariant,
  CompanyExpenseBulkRow,
  CompanyIncomeBulkRow,
  EngineerBulkRow,
  PersonalExpenseBulkRow,
  ProjectBulkRow,
} from "@/lib/expense/bulk-entry-types"
import { categoryUsesLabourTeams } from "@/lib/expense/bulk-entry-project"
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"

type Milestone = { id: string; name: string }
type LabourTeam = { id: string; name: string }

interface BulkEntryCompletedTableProps {
  variant: BulkEntryVariant
  projectRows?: ProjectBulkRow[]
  engineerRows?: EngineerBulkRow[]
  companyExpenseRows?: CompanyExpenseBulkRow[]
  companyIncomeRows?: CompanyIncomeBulkRow[]
  personalRows?: PersonalExpenseBulkRow[]
  expenseCategories?: ExpenseCategoryView[]
  labourTeams?: LabourTeam[]
  milestones?: Milestone[]
  onRemove: (id: string) => void
}

export function BulkEntryCompletedTable({
  variant,
  projectRows = [],
  engineerRows = [],
  companyExpenseRows = [],
  companyIncomeRows = [],
  personalRows = [],
  expenseCategories = [],
  labourTeams = [],
  milestones = [],
  onRemove,
}: BulkEntryCompletedTableProps) {
  const milestoneName = (id: string) =>
    milestones.find((m) => m.id === id)?.name ?? "—"
  const teamName = (id: string) =>
    labourTeams.find((t) => t.id === id)?.name ?? "—"

  if (variant === "project" && projectRows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Completed lines appear here. Finish a line with Add line or Enter on Amount.
      </p>
    )
  }

  if (variant === "project") {
    return (
      <div className="max-h-48 overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Subcategory / Team</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {projectRows.map((row, i) => {
              const usesLabour = categoryUsesLabourTeams(row.category, expenseCategories)
              return (
                <TableRow key={row.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.category}</TableCell>
                  <TableCell>
                    {usesLabour ? teamName(row.labourTeamId) : row.subcategory || "—"}
                  </TableCell>
                  <TableCell>{milestoneName(row.milestoneId)}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                  <TableCell className="text-right">{formatINR(Number(row.amount))}</TableCell>
                  <TableCell>{row.vendor || "—"}</TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(row.id)}
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (variant === "engineer") {
    if (engineerRows.length === 0) {
      return (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Completed lines appear here.
        </p>
      )
    }
    return (
      <div className="max-h-48 overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {engineerRows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell>{milestoneName(row.milestoneId)}</TableCell>
                <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                <TableCell className="text-right">{formatINR(Number(row.amount))}</TableCell>
                <TableCell>{row.vendor || "—"}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(row.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (variant === "company_expense") {
    if (companyExpenseRows.length === 0) {
      return (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Completed lines appear here.
        </p>
      )
    }
    return (
      <div className="max-h-48 overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companyExpenseRows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                <TableCell className="text-right">{formatINR(Number(row.amount))}</TableCell>
                <TableCell>{row.vendor || "—"}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(row.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (variant === "company_income") {
    if (companyIncomeRows.length === 0) {
      return (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Completed lines appear here.
        </p>
      )
    }
    return (
      <div className="max-h-48 overflow-auto rounded-md border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {companyIncomeRows.map((row, i) => (
              <TableRow key={row.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{row.date}</TableCell>
                <TableCell>{row.category}</TableCell>
                <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
                <TableCell className="text-right">{formatINR(Number(row.amount))}</TableCell>
                <TableCell>{row.source || "—"}</TableCell>
                <TableCell>
                  <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(row.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  if (personalRows.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        Completed lines appear here.
      </p>
    )
  }

  return (
    <div className="max-h-48 overflow-auto rounded-md border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {personalRows.map((row, i) => (
            <TableRow key={row.id}>
              <TableCell>{i + 1}</TableCell>
              <TableCell>{row.date}</TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell className="max-w-[200px] truncate">{row.description}</TableCell>
              <TableCell className="text-right">{formatINR(Number(row.amount))}</TableCell>
              <TableCell>
                <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(row.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
