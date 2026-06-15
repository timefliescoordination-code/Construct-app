"use client"

import type {
  ChangeEvent,
  Dispatch,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Pencil, Upload } from "lucide-react"
import { formatFileSize } from "@/lib/file-upload"
import { useMandatoryExpenseKeyboard } from "@/lib/keyboard/mandatory-expense-keyboard"
import { PendingSplitSuggestion } from "@/components/projects/project-detail/pending-split-suggestion"
import { cn } from "@/lib/utils"

type SelectBind = ReturnType<
  NonNullable<ReturnType<typeof useMandatoryExpenseKeyboard>>["bindSelect"]
>

function KeyboardSelectTriggerContent({
  bind,
  placeholder,
  displayValue,
}: {
  bind?: SelectBind
  placeholder: string
  displayValue?: string
}) {
  if (bind?.typePrefix) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <kbd className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-sm text-primary">
          {bind.typePrefix}
        </kbd>
        <span className="truncate text-muted-foreground text-sm">
          type more to narrow…
        </span>
      </span>
    )
  }
  if (displayValue) {
    return <span className="truncate">{displayValue}</span>
  }
  return <SelectValue placeholder={placeholder} />
}

function KeyboardSelectContent({
  bind,
  children,
  empty = false,
}: {
  bind?: SelectBind
  children: ReactNode
  empty?: boolean
}) {
  return (
    <SelectContent className="z-[100]">
      {bind?.typePrefix ? (
        <div className="border-b border-border px-2 py-1.5 text-xs text-muted-foreground">
          Showing matches for{" "}
          <kbd className="rounded border bg-muted px-1 font-mono">{bind.typePrefix}</kbd>
        </div>
      ) : null}
      {empty && bind?.typePrefix ? (
        <p className="px-2 py-3 text-center text-sm text-muted-foreground">
          No matches — Backspace to edit
        </p>
      ) : (
        children
      )}
    </SelectContent>
  )
}

const EXPENSE_FORM_ROW = "grid grid-cols-1 gap-4 sm:grid-cols-2"

type NewExpenseForm = {
  date: string
  category: string
  subcategory: string
  labourTeamId: string
  description: string
  vendor: string
  amount: string
  billNumber: string
  milestoneId: string
}

type LabourTeamOption = { id: string; name: string }
type Milestone = { id: string; name: string }

type SuggestedSplitGroup = {
  groupId: string
  total: number
  recorded: number
  remaining: number
  vendor: string | null
  splitCount: number
  category: string
  teamLabel: string
}

interface ProjectAddExpenseDialogFormProps {
  newExpense: NewExpenseForm
  setNewExpense: Dispatch<SetStateAction<NewExpenseForm>>
  categoryNames: string[]
  labourTeams: LabourTeamOption[]
  subcategoriesForCategory: Map<string, string[]>
  milestones: Milestone[]
  canManageProjects: boolean
  usesLabourCategory: boolean
  splitMode: boolean
  setSplitMode: (value: boolean) => void
  splitFirstAmount: string
  setSplitFirstAmount: (value: string) => void
  suggestedSplitGroup: SuggestedSplitGroup | null
  loadingOpenSplits: boolean
  isSubmitting: boolean
  invoiceFile: File | null
  invoiceFileInputRef: RefObject<HTMLInputElement | null>
  handleInvoiceFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  handleUseSuggestedSplit: () => void
  openSubcategoryManage: () => void
  setCategoryManageOpen: (open: boolean) => void
}

export function ProjectAddExpenseDialogForm({
  newExpense,
  setNewExpense,
  categoryNames,
  labourTeams,
  subcategoriesForCategory,
  milestones,
  canManageProjects,
  usesLabourCategory,
  splitMode,
  setSplitMode,
  splitFirstAmount,
  setSplitFirstAmount,
  suggestedSplitGroup,
  loadingOpenSplits,
  isSubmitting,
  invoiceFile,
  invoiceFileInputRef,
  handleInvoiceFileChange,
  handleUseSuggestedSplit,
  openSubcategoryManage,
  setCategoryManageOpen,
}: ProjectAddExpenseDialogFormProps) {
  const kb = useMandatoryExpenseKeyboard()
  const dateBind = kb?.bindDate("date")
  const categoryBind = kb?.bindSelect("category")
  const teamBind = kb?.bindSelect("subcategoryOrTeam")
  const subcategoryBind = kb?.bindSelect("subcategory")
  const milestoneBind = kb?.bindSelect("milestone")
  const descriptionBind = kb?.bindText("description", { multiline: true })
  const amountBind = kb?.bindText("amount")
  const vendorBind = kb?.bindText("vendor")
  const splitFirstBind = kb?.bindText("splitFirstAmount")

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
      <div className="grid gap-4">
        <div className={EXPENSE_FORM_ROW}>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input
              type="date"
              value={newExpense.date}
              onChange={(e) =>
                setNewExpense({ ...newExpense, date: e.target.value })
              }
              className="bg-muted border-border"
              ref={dateBind?.ref}
              onKeyDown={dateBind?.onKeyDown}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>Category *</Label>
              {canManageProjects && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => setCategoryManageOpen(true)}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
            <Select
              value={newExpense.category}
              onValueChange={(val) =>
                setNewExpense({
                  ...newExpense,
                  category: val,
                  subcategory: "",
                  labourTeamId: "",
                })
              }
              open={categoryBind?.open}
              onOpenChange={categoryBind?.onOpenChange}
            >
              <SelectTrigger
                ref={categoryBind?.triggerRef}
                className={cn(
                  "bg-muted border-border",
                  categoryBind?.typePrefix && "ring-1 ring-primary/40",
                )}
                onKeyDown={categoryBind?.onTriggerKeyDown}
              >
                <KeyboardSelectTriggerContent
                  bind={categoryBind}
                  placeholder="Select category"
                  displayValue={newExpense.category || undefined}
                />
              </SelectTrigger>
              <KeyboardSelectContent
                bind={categoryBind}
                empty={
                  categoryNames.filter(
                    (cat) => categoryBind?.isOptionVisible(cat, cat) ?? true,
                  ).length === 0
                }
              >
                {categoryNames
                  .filter((cat) => categoryBind?.isOptionVisible(cat, cat) ?? true)
                  .map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
              </KeyboardSelectContent>
            </Select>
          </div>
        </div>
        <div className={EXPENSE_FORM_ROW}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{usesLabourCategory ? "Labour team *" : "Subcategory *"}</Label>
              {canManageProjects && newExpense.category && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={openSubcategoryManage}
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
            {usesLabourCategory ? (
              <Select
                value={newExpense.labourTeamId}
                onValueChange={(val) =>
                  setNewExpense({ ...newExpense, labourTeamId: val })
                }
                open={teamBind?.open}
                onOpenChange={teamBind?.onOpenChange}
              >
                <SelectTrigger
                  ref={teamBind?.triggerRef}
                  className={cn(
                    "bg-muted border-border",
                    teamBind?.typePrefix && "ring-1 ring-primary/40",
                  )}
                  onKeyDown={teamBind?.onTriggerKeyDown}
                >
                  <KeyboardSelectTriggerContent
                    bind={teamBind}
                    placeholder="Which team was paid?"
                    displayValue={
                      labourTeams.find((t) => t.id === newExpense.labourTeamId)?.name
                    }
                  />
                </SelectTrigger>
                <KeyboardSelectContent
                  bind={teamBind}
                  empty={
                    labourTeams.filter((team) =>
                      teamBind?.isOptionVisible(team.name, team.id) ?? true,
                    ).length === 0
                  }
                >
                  {labourTeams
                    .filter((team) =>
                      teamBind?.isOptionVisible(team.name, team.id) ?? true,
                    )
                    .map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                </KeyboardSelectContent>
              </Select>
            ) : (
              <Select
                value={newExpense.subcategory}
                onValueChange={(val) =>
                  setNewExpense({ ...newExpense, subcategory: val })
                }
                disabled={!newExpense.category}
                open={subcategoryBind?.open}
                onOpenChange={subcategoryBind?.onOpenChange}
              >
                <SelectTrigger
                  ref={subcategoryBind?.triggerRef}
                  className={cn(
                    "bg-muted border-border",
                    subcategoryBind?.typePrefix && "ring-1 ring-primary/40",
                  )}
                  onKeyDown={subcategoryBind?.onTriggerKeyDown}
                >
                  <KeyboardSelectTriggerContent
                    bind={subcategoryBind}
                    placeholder="Select subcategory"
                    displayValue={newExpense.subcategory || undefined}
                  />
                </SelectTrigger>
                <KeyboardSelectContent
                  bind={subcategoryBind}
                  empty={
                    (subcategoriesForCategory.get(newExpense.category) ?? []).filter(
                      (sub) => subcategoryBind?.isOptionVisible(sub, sub) ?? true,
                    ).length === 0
                  }
                >
                  {newExpense.category &&
                    subcategoriesForCategory
                      .get(newExpense.category)
                      ?.filter((sub) =>
                        subcategoryBind?.isOptionVisible(sub, sub) ?? true,
                      )
                      .map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                </KeyboardSelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label>Stage/Milestone *</Label>
            <Select
              value={newExpense.milestoneId}
              onValueChange={(val) =>
                setNewExpense({ ...newExpense, milestoneId: val })
              }
              open={milestoneBind?.open}
              onOpenChange={milestoneBind?.onOpenChange}
            >
              <SelectTrigger
                ref={milestoneBind?.triggerRef}
                className={cn(
                  "bg-muted border-border",
                  milestoneBind?.typePrefix && "ring-1 ring-primary/40",
                )}
                onKeyDown={milestoneBind?.onTriggerKeyDown}
              >
                <KeyboardSelectTriggerContent
                  bind={milestoneBind}
                  placeholder="Select milestone"
                  displayValue={
                    milestones.find((m) => m.id === newExpense.milestoneId)?.name
                  }
                />
              </SelectTrigger>
              <KeyboardSelectContent
                bind={milestoneBind}
                empty={
                  milestones.filter((milestone) =>
                    milestoneBind?.isOptionVisible(milestone.name, milestone.id) ??
                    true,
                  ).length === 0
                }
              >
                {milestones
                  .filter((milestone) =>
                    milestoneBind?.isOptionVisible(milestone.name, milestone.id) ??
                    true,
                  )
                  .map((milestone) => (
                    <SelectItem key={milestone.id} value={milestone.id}>
                      {milestone.name}
                    </SelectItem>
                  ))}
              </KeyboardSelectContent>
            </Select>
          </div>
        </div>
        {suggestedSplitGroup && !splitMode && (
          <PendingSplitSuggestion
            label={suggestedSplitGroup.teamLabel}
            category={suggestedSplitGroup.category}
            recorded={suggestedSplitGroup.recorded}
            total={suggestedSplitGroup.total}
            remaining={suggestedSplitGroup.remaining}
            splitCount={suggestedSplitGroup.splitCount}
            vendor={suggestedSplitGroup.vendor}
            onContinue={handleUseSuggestedSplit}
          />
        )}
        {loadingOpenSplits &&
          newExpense.category &&
          (newExpense.labourTeamId || newExpense.subcategory) &&
          !suggestedSplitGroup &&
          !splitMode && (
            <p className="text-xs text-muted-foreground">
              Checking for pending split payments…
            </p>
          )}
        <div className="space-y-2">
          <Label>Description *</Label>
          <Textarea
            value={newExpense.description}
            onChange={(e) =>
              setNewExpense({ ...newExpense, description: e.target.value })
            }
            placeholder="Enter expense description..."
            className="bg-muted border-border"
            ref={descriptionBind?.ref}
            onKeyDown={descriptionBind?.onKeyDown}
          />
        </div>
        <div className={EXPENSE_FORM_ROW}>
          <div className="space-y-2">
            <Label>{splitMode ? "Vendor *" : "Vendor"}</Label>
            <Input
              value={newExpense.vendor}
              onChange={(e) =>
                setNewExpense({ ...newExpense, vendor: e.target.value })
              }
              placeholder="Vendor name"
              className="bg-muted border-border"
              ref={vendorBind?.ref}
              onKeyDown={vendorBind?.onKeyDown}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label>{splitMode ? "Total amount *" : "Amount *"}</Label>
              {!splitMode && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="text-xs text-primary underline-offset-2 hover:underline"
                        onClick={() => {
                          setSplitMode(true)
                          setSplitFirstAmount("")
                        }}
                      >
                        Want to split the payment?
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      This option allows you to split the amount, and part payment you
                      can pay later.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Input
              type="number"
              value={newExpense.amount}
              onChange={(e) =>
                setNewExpense({ ...newExpense, amount: e.target.value })
              }
              placeholder="0.00"
              className="bg-muted border-border"
              ref={amountBind?.ref}
              onKeyDown={amountBind?.onKeyDown}
            />
            {splitMode && (
              <button
                type="button"
                className="text-xs text-muted-foreground underline"
                onClick={() => {
                  setSplitMode(false)
                  setSplitFirstAmount("")
                }}
              >
                Cancel split (single payment)
              </button>
            )}
          </div>
        </div>
        {splitMode && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <Label>First payment today *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={splitFirstAmount}
              onChange={(e) => setSplitFirstAmount(e.target.value)}
              placeholder="Amount paid today"
              className="bg-muted border-border"
              disabled={isSubmitting}
              ref={splitFirstBind?.ref}
              onKeyDown={splitFirstBind?.onKeyDown}
            />
            <p className="text-xs text-muted-foreground">
              Uses the expense date above. You can record split 2, 3, and more on
              their actual dates later — no need to finish the full total now. Each
              payment appears in the expenses table by date.
            </p>
          </div>
        )}
        <div className={EXPENSE_FORM_ROW}>
          <div className="space-y-2">
            <Label>Bill Number</Label>
            <Input
              value={newExpense.billNumber}
              onChange={(e) =>
                setNewExpense({ ...newExpense, billNumber: e.target.value })
              }
              placeholder="INV-001"
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label>Upload Invoice</Label>
            <input
              ref={invoiceFileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              className="hidden"
              onChange={handleInvoiceFileChange}
              disabled={isSubmitting}
            />
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 bg-muted border-border"
              onClick={() => invoiceFileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              <Upload className="h-4 w-4" />
              {invoiceFile ? "Change Invoice" : "Upload Invoice"}
            </Button>
            {invoiceFile ? (
              <p className="text-xs text-muted-foreground">
                {invoiceFile.name} ({formatFileSize(invoiceFile.size)})
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                PDF, JPG, JPEG, or PNG up to 10MB. Optional — works with split
                payments too (invoice links to the split group).
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
