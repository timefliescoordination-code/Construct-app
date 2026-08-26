import { Metadata } from "next"
import { LabourSettingsContent } from "@/components/admin/labour-settings-content"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Manage labours | VRA HOMES",
  description: "Add or edit labour teams and the roles linked under each team",
}

export default function LabourSettingsPage() {
  return <LabourSettingsContent />
}
