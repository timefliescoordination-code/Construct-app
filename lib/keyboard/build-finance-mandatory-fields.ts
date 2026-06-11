import type {
  MandatoryFieldDef,
  MandatorySelectOption,
} from "@/lib/keyboard/mandatory-expense-fields"

export function buildFinanceEntryFields(opts: {
  categoryOptions: MandatorySelectOption[]
  getCategory: () => string
  setCategory: (value: string) => void
  getDescription: () => string
  getAmount: () => string
}): MandatoryFieldDef[] {
  return [
    { id: "date", kind: "date" },
    {
      id: "category",
      kind: "select",
      options: opts.categoryOptions,
      getValue: opts.getCategory,
      setValue: opts.setCategory,
      validate: () => (opts.getCategory() ? null : "Select a category"),
    },
    {
      id: "description",
      kind: "text",
      validate: () =>
        opts.getDescription().trim() ? null : "Enter a description",
    },
    {
      id: "amount",
      kind: "number",
      validate: () => {
        const amount = Number(opts.getAmount())
        if (!Number.isFinite(amount) || amount < 0) {
          return "Enter a valid amount"
        }
        return null
      },
    },
  ]
}
