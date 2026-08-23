import { Metadata } from "next"
import { CompanySettingsContent } from "@/components/admin/company-settings-content"

export const metadata: Metadata = {
  title: "Company Details | VRA HOMES",
  description: "Manage company branding and contact information",
}

export default function AdminCompanyPage() {
  return <CompanySettingsContent />
}
