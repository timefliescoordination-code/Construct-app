import { Metadata } from "next"
import { MilestoneSettingsContent } from "@/components/admin/milestone-settings-content"

export const metadata: Metadata = {
  title: "Milestones | VRA HOMES",
  description: "Add, edit, or delete construction stage templates for upcoming projects",
}

export default function MilestoneSettingsPage() {
  return <MilestoneSettingsContent />
}
