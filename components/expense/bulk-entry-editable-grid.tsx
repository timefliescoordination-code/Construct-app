"use client"

import type { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/currency"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { ExpenseCategoryView } from "@/lib/data/expense-categories"
import type {
  CompanyExpenseBulkRow,
  CompanyIncomeBulkRow,
  EngineerBulkRow,
  PersonalExpenseBulkRow,
  ProjectBulkRow,
} from "@/lib/expense/bulk-entry-types"
import { categoryUsesLabourTeams } from "@/lib/expense/bulk-entry-project"

const CELL_INPUT =
  "h-8 min-w-0 border-0 bg-transparent px-2 shadow-none focus-visible:ring-1 focus-visible:ring-primary/40 rounded-sm"
const CELL_SELECT =
  "h-8 w-full min-w-0 border-0 bg-transparent px-2 shadow-none focus:ring-1 focus:ring-primary/40 rounded-sm"

type Milestone = { id: string; name: string }
type LabourTeam = { id: string; name: string }

const ENGINEER_CATEGORIES = ["Materials", "Labour", "Equipment", "Miscellaneous"]

function RequiredLabel({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span className="text-destructive"> *</span>
    </>
  )
}

function parseRowAmount(value: string) {
  const n = parseFloat(String(value).replace(/[₹,\s]/g, ""))
  return Number.isFinite(n) ? n : 0
}

export function projectRowHasContent(row: ProjectBulkRow) {
  return !!(
    row.category ||
    row.subcategory ||
    row.labourTeamId ||
    row.milestoneId ||
    row.description.trim() ||
    row.vendor.trim() ||
    row.amount.trim()
  )
}

export function engineerRowHasContent(row: EngineerBulkRow) {
  return !!(
    row.category ||
    row.milestoneId ||
    row.description.trim() ||
    row.vendor.trim() ||
    row.amount.trim()
  )
}

export function companyExpenseRowHasContent(row: CompanyExpenseBulkRow) {
  return !!(
    row.category ||
    row.description.trim() ||
    row.vendor.trim() ||
    row.amount.trim()
  )
}

export function companyIncomeRowHasContent(row: CompanyIncomeBulkRow) {
  return !!(
    row.category ||
    row.description.trim() ||
    row.source.trim() ||
    row.amount.trim()
  )
}

export function personalRowHasContent(row: PersonalExpenseBulkRow) {
  return !!(row.category || row.description.trim() || row.amount.trim())
}

type ProjectGridProps = {
  variant: "project"
  rows: ProjectBulkRow[]
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onUpdateRow: (id: string, patch: Partial<ProjectBulkRow>) => void
  categoryNames: string[]
  expenseCategories: ExpenseCategoryView[]
  labourTeams: LabourTeam[]
  milestones: Milestone[]
  subcategoriesForCategory: Map<string, string[]>
}

type EngineerGridProps = {
  variant: "engineer"
  rows: EngineerBulkRow[]
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onUpdateRow: (id: string, patch: Partial<EngineerBulkRow>) => void
  milestones: Milestone[]
}

type CompanyExpenseGridProps = {
  variant: "company_expense"
  rows: CompanyExpenseBulkRow[]
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onUpdateRow: (id: string, patch: Partial<CompanyExpenseBulkRow>) => void
  categories: string[]
}

type CompanyIncomeGridProps = {
  variant: "company_income"
  rows: CompanyIncomeBulkRow[]
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onUpdateRow: (id: string, patch: Partial<CompanyIncomeBulkRow>) => void
  categories: string[]
}

type PersonalGridProps = {
  variant: "personal_expense"
  rows: PersonalExpenseBulkRow[]
  selectedRowId: string | null
  onSelectRow: (id: string) => void
  onUpdateRow: (id: string, patch: Partial<PersonalExpenseBulkRow>) => void
  categories: string[]
}

export type BulkEntryEditableGridProps =
  | ProjectGridProps
  | EngineerGridProps
  | CompanyExpenseGridProps
  | CompanyIncomeGridProps
  | PersonalGridProps

export function BulkEntryEditableGrid(props: BulkEntryEditableGridProps) {
  if (props.variant === "project") return <ProjectBulkGrid {...props} />
  if (props.variant === "engineer") return <EngineerBulkGrid {...props} />
  if (props.variant === "company_expense") return <CompanyExpenseBulkGrid {...props} />
  if (props.variant === "company_income") return <CompanyIncomeBulkGrid {...props} />
  return <PersonalBulkGrid {...props} />
}

function rowClass(selected: boolean) {
  return cn(
    "cursor-pointer border-border/60",
    selected && "bg-primary/5 ring-1 ring-inset ring-primary/20",
  )
}

function ProjectBulkGrid({
  rows,
  selectedRowId,
  onSelectRow,
  onUpdateRow,
  categoryNames,
  expenseCategories,
  labourTeams,
  milestones,
  subcategoriesForCategory,
}: ProjectGridProps) {
  const filledCount = rows.filter(projectRowHasContent).length
  const totalAmount = rows.reduce((sum, row) => sum + parseRowAmount(row.amount), 0)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table className="w-full table-fixed min-w-[1000px] lg:min-w-0">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="w-[9%]">
              <RequiredLabel>Date</RequiredLabel>
            </TableHead>
            <TableHead className="w-[11%]">
              <RequiredLabel>Category</RequiredLabel>
            </TableHead>
            <TableHead className="w-[13%]">
              <RequiredLabel>Subcategory/Team</RequiredLabel>
            </TableHead>
            <TableHead className="w-[13%]">
              <RequiredLabel>Stage/Milestone</RequiredLabel>
            </TableHead>
            <TableHead className="w-[22%]">
              <RequiredLabel>Description</RequiredLabel>
            </TableHead>
            <TableHead className="w-[14%]">Vendor</TableHead>
            <TableHead className="w-[10%] text-right">
              <RequiredLabel>Amount</RequiredLabel>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => {
            const usesLabour = categoryUsesLabourTeams(row.category, expenseCategories)
            const subcategories = subcategoriesForCategory.get(row.category) ?? []
            return (
              <TableRow
                key={row.id}
                className={rowClass(selectedRowId === row.id)}
                onClick={() => onSelectRow(row.id)}
              >
                <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                <TableCell className="p-1">
                  <Input
                    type="date"
                    value={row.date}
                    onChange={(e) => onUpdateRow(row.id, { date: e.target.value })}
                    className={CELL_INPUT}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Select
                    value={row.category || undefined}
                    onValueChange={(value) =>
                      onUpdateRow(row.id, {
                        category: value,
                        subcategory: "",
                        labourTeamId: "",
                      })
                    }
                  >
                    <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {categoryNames.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-1">
                  {usesLabour ? (
                    <Select
                      value={row.labourTeamId || undefined}
                      onValueChange={(value) => onUpdateRow(row.id, { labourTeamId: value })}
                      disabled={!row.category}
                    >
                      <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {labourTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={row.subcategory || undefined}
                      onValueChange={(value) => onUpdateRow(row.id, { subcategory: value })}
                      disabled={!row.category}
                    >
                      <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent className="z-[100]">
                        {subcategories.map((sub) => (
                          <SelectItem key={sub} value={sub}>
                            {sub}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="p-1">
                  <Select
                    value={row.milestoneId || undefined}
                    onValueChange={(value) => onUpdateRow(row.id, { milestoneId: value })}
                  >
                    <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {milestones.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    value={row.description}
                    onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                    placeholder="Enter description"
                    className={CELL_INPUT}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    value={row.vendor}
                    onChange={(e) => onUpdateRow(row.id, { vendor: e.target.value })}
                    placeholder="Enter vendor"
                    className={CELL_INPUT}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
                <TableCell className="p-1">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                    placeholder="0.00"
                    className={cn(CELL_INPUT, "text-right")}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
              </TableRow>
            )
          })}
          <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium">
            <TableCell colSpan={7} className="text-right text-sm text-muted-foreground">
              Total ({filledCount} line{filledCount === 1 ? "" : "s"})
            </TableCell>
            <TableCell className="p-2 text-right">{formatINR(totalAmount)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function EngineerBulkGrid({
  rows,
  selectedRowId,
  onSelectRow,
  onUpdateRow,
  milestones,
}: EngineerGridProps) {
  const filledCount = rows.filter(engineerRowHasContent).length
  const totalAmount = rows.reduce((sum, row) => sum + parseRowAmount(row.amount), 0)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table className="w-full table-fixed min-w-[1000px] lg:min-w-0">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="w-[14%]">
              <RequiredLabel>Category</RequiredLabel>
            </TableHead>
            <TableHead className="w-[16%]">Milestone</TableHead>
            <TableHead className="w-[32%]">
              <RequiredLabel>Description</RequiredLabel>
            </TableHead>
            <TableHead className="w-[18%]">Vendor</TableHead>
            <TableHead className="w-[12%] text-right">
              <RequiredLabel>Amount</RequiredLabel>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={rowClass(selectedRowId === row.id)}
              onClick={() => onSelectRow(row.id)}
            >
              <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="p-1">
                <Select
                  value={row.category || undefined}
                  onValueChange={(value) => onUpdateRow(row.id, { category: value })}
                >
                  <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {ENGINEER_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Select
                  value={row.milestoneId || undefined}
                  onValueChange={(value) => onUpdateRow(row.id, { milestoneId: value })}
                >
                  <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {milestones.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.description}
                  onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                  placeholder="Enter description"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.vendor}
                  onChange={(e) => onUpdateRow(row.id, { vendor: e.target.value })}
                  placeholder="Enter vendor"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                  placeholder="0.00"
                  className={cn(CELL_INPUT, "text-right")}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium">
            <TableCell colSpan={5} className="text-right text-sm text-muted-foreground">
              Total ({filledCount} line{filledCount === 1 ? "" : "s"})
            </TableCell>
            <TableCell className="p-2 text-right">{formatINR(totalAmount)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function CompanyExpenseBulkGrid({
  rows,
  selectedRowId,
  onSelectRow,
  onUpdateRow,
  categories,
}: CompanyExpenseGridProps) {
  const filledCount = rows.filter(companyExpenseRowHasContent).length
  const totalAmount = rows.reduce((sum, row) => sum + parseRowAmount(row.amount), 0)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table className="w-full table-fixed min-w-[900px] lg:min-w-0">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="w-[12%]">
              <RequiredLabel>Date</RequiredLabel>
            </TableHead>
            <TableHead className="w-[14%]">
              <RequiredLabel>Category</RequiredLabel>
            </TableHead>
            <TableHead className="w-[32%]">
              <RequiredLabel>Description</RequiredLabel>
            </TableHead>
            <TableHead className="w-[18%]">Vendor</TableHead>
            <TableHead className="w-[12%] text-right">
              <RequiredLabel>Amount</RequiredLabel>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={rowClass(selectedRowId === row.id)}
              onClick={() => onSelectRow(row.id)}
            >
              <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="p-1">
                <Input
                  type="date"
                  value={row.date}
                  onChange={(e) => onUpdateRow(row.id, { date: e.target.value })}
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Select
                  value={row.category || undefined}
                  onValueChange={(value) => onUpdateRow(row.id, { category: value })}
                >
                  <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.description}
                  onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                  placeholder="Enter description"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.vendor}
                  onChange={(e) => onUpdateRow(row.id, { vendor: e.target.value })}
                  placeholder="Enter vendor"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                  placeholder="0.00"
                  className={cn(CELL_INPUT, "text-right")}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium">
            <TableCell colSpan={5} className="text-right text-sm text-muted-foreground">
              Total ({filledCount} line{filledCount === 1 ? "" : "s"})
            </TableCell>
            <TableCell className="p-2 text-right">{formatINR(totalAmount)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function CompanyIncomeBulkGrid({
  rows,
  selectedRowId,
  onSelectRow,
  onUpdateRow,
  categories,
}: CompanyIncomeGridProps) {
  const filledCount = rows.filter(companyIncomeRowHasContent).length
  const totalAmount = rows.reduce((sum, row) => sum + parseRowAmount(row.amount), 0)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table className="w-full table-fixed min-w-[900px] lg:min-w-0">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="w-[12%]">
              <RequiredLabel>Date</RequiredLabel>
            </TableHead>
            <TableHead className="w-[14%]">
              <RequiredLabel>Category</RequiredLabel>
            </TableHead>
            <TableHead className="w-[30%]">
              <RequiredLabel>Description</RequiredLabel>
            </TableHead>
            <TableHead className="w-[18%]">Source</TableHead>
            <TableHead className="w-[12%] text-right">
              <RequiredLabel>Amount</RequiredLabel>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={rowClass(selectedRowId === row.id)}
              onClick={() => onSelectRow(row.id)}
            >
              <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="p-1">
                <Input
                  type="date"
                  value={row.date}
                  onChange={(e) => onUpdateRow(row.id, { date: e.target.value })}
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Select
                  value={row.category || undefined}
                  onValueChange={(value) => onUpdateRow(row.id, { category: value })}
                >
                  <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.description}
                  onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                  placeholder="Enter description"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.source}
                  onChange={(e) => onUpdateRow(row.id, { source: e.target.value })}
                  placeholder="Enter source"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                  placeholder="0.00"
                  className={cn(CELL_INPUT, "text-right")}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium">
            <TableCell colSpan={5} className="text-right text-sm text-muted-foreground">
              Total ({filledCount} line{filledCount === 1 ? "" : "s"})
            </TableCell>
            <TableCell className="p-2 text-right">{formatINR(totalAmount)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

function PersonalBulkGrid({
  rows,
  selectedRowId,
  onSelectRow,
  onUpdateRow,
  categories,
}: PersonalGridProps) {
  const filledCount = rows.filter(personalRowHasContent).length
  const totalAmount = rows.reduce((sum, row) => sum + parseRowAmount(row.amount), 0)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <Table className="w-full table-fixed min-w-[720px] lg:min-w-0">
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-10 text-center">#</TableHead>
            <TableHead className="w-[14%]">
              <RequiredLabel>Date</RequiredLabel>
            </TableHead>
            <TableHead className="w-[16%]">
              <RequiredLabel>Category</RequiredLabel>
            </TableHead>
            <TableHead className="w-[44%]">
              <RequiredLabel>Description</RequiredLabel>
            </TableHead>
            <TableHead className="w-[14%] text-right">
              <RequiredLabel>Amount</RequiredLabel>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow
              key={row.id}
              className={rowClass(selectedRowId === row.id)}
              onClick={() => onSelectRow(row.id)}
            >
              <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
              <TableCell className="p-1">
                <Input
                  type="date"
                  value={row.date}
                  onChange={(e) => onUpdateRow(row.id, { date: e.target.value })}
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Select
                  value={row.category || undefined}
                  onValueChange={(value) => onUpdateRow(row.id, { category: value })}
                >
                  <SelectTrigger className={CELL_SELECT} onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent className="z-[100]">
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="p-1">
                <Input
                  value={row.description}
                  onChange={(e) => onUpdateRow(row.id, { description: e.target.value })}
                  placeholder="Enter description"
                  className={CELL_INPUT}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
              <TableCell className="p-1">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(e) => onUpdateRow(row.id, { amount: e.target.value })}
                  placeholder="0.00"
                  className={cn(CELL_INPUT, "text-right")}
                  onClick={(e) => e.stopPropagation()}
                />
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium">
            <TableCell colSpan={4} className="text-right text-sm text-muted-foreground">
              Total ({filledCount} line{filledCount === 1 ? "" : "s"})
            </TableCell>
            <TableCell className="p-2 text-right">{formatINR(totalAmount)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}

export function bulkEntryRequiredNote(variant: BulkEntryEditableGridProps["variant"]) {
  switch (variant) {
    case "project":
      return "Date, Category, Subcategory/Team, Stage/Milestone, Description, and Amount are required for each line."
    case "engineer":
      return "Category, Description, and Amount are required for each line."
    case "company_expense":
    case "company_income":
    case "personal_expense":
      return "Date, Category, Description, and Amount are required for each line."
  }
}
