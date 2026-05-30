import { Metadata } from "next"
import { MaterialIntelligencePage } from "@/components/admin/material-intelligence-page"

export const metadata: Metadata = {
  title: "Material Intelligence | VRA HOMES",
  description: "Material rate tracking and purchase history",
}

export default function AdminMaterialIntelligencePage() {
  return <MaterialIntelligencePage />
}
