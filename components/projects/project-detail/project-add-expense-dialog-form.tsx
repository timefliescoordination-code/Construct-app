"use client"

import type { ChangeEvent, Dispatch, RefObject, SetStateAction } from "react"
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
  const descriptionBind = kb?.bindText("description")
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
                className="bg-muted border-border"
                onKeyDown={categoryBind?.onTriggerKeyDown}
              >
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categoryNames.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
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
                  className="bg-muted border-border"
                  onKeyDown={teamBind?.onTriggerKeyDown}
                >
                  <SelectValue placeholder="Which team was paid?" />
                </SelectTrigger>
                <SelectContent>
                  {labourTeams.map((team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
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
                  className="bg-muted border-border"
                  onKeyDown={subcategoryBind?.onTriggerKeyDown}
                >
                  <SelectValue placeholder="Select subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {newExpense.category &&
                    subcategoriesForCategory
                      .get(newExpense.category)
                      ?.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                </SelectContent>
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
                className="bg-muted border-border"
                onKeyDown={milestoneBind?.onTriggerKeyDown}
              >
                <SelectValue placeholder="Select milestone" />
              </SelectTrigger>
              <SelectContent>
                {milestones.map((milestone) => (
                  <SelectItem key={milestone.id} value={milestone.id}>
                    {milestone.name}
                  </SelectItem>
                ))}
              </SelectContent>
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
