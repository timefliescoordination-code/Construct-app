import { Metadata } from "next"
import { ExpenseInputSettingsContent } from "@/components/admin/expense-input-settings-content"

export const metadata: Metadata = {
  title: "Manage expense input | VRA HOMES",
  description: "Add, edit, or delete expense categories and subcategories for upcoming entries",
}

export default function ExpenseInputSettingsPage() {
  return <ExpenseInputSettingsContent />
}
