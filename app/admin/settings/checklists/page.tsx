import { Metadata } from 'next'
import { ChecklistSettingsContent } from '@/components/admin/checklist-settings-content'

export const metadata: Metadata = {
  title: 'Quality checklists | VRA HOMES',
  description: 'Manage reusable construction quality inspection templates',
}

export default function ChecklistSettingsPage() {
  return <ChecklistSettingsContent />
}
