"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Building2, ImageIcon, Loader2, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DashboardHeader } from "@/components/dashboard/header"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"
import type { CompanySettingsView } from "@/lib/company/settings"
import {
  removeCompanyLogoAction,
  updateCompanySettingsAction,
  uploadCompanyLogoAction,
} from "@/lib/company/actions"
import { useAuth } from "@/lib/hooks/use-auth"

const DEFAULT_LOGO = "/images/vra-logo.png"

export function CompanySettingsContent() {
  const router = useRouter()
  const { isAdmin, isLoading: authLoading } = useAuth()
  const [settings, setSettings] = useState<CompanySettingsView | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUploading, setLogoUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/login")
    }
  }, [authLoading, isAdmin, router])

  const [form, setForm] = useState({
    company_name: "",
    phone: "",
    email: "",
    address: "",
    website: "",
    proposal_default_notes: "",
  })

  const loadSettings = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/company-settings", {
        credentials: "include",
        cache: "no-store",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load company settings")

      const data = (json.data ?? null) as CompanySettingsView | null
      setSettings(data)
      setForm({
        company_name: data?.company_name ?? "",
        phone: data?.phone ?? "",
        email: data?.email ?? "",
        address: data?.address ?? "",
        website: data?.website ?? "",
        proposal_default_notes: data?.proposal_default_notes ?? "",
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load settings")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  const handleSave = async () => {
    setSaving(true)
    try {
      const formData = new FormData()
      formData.set("company_name", form.company_name)
      formData.set("phone", form.phone)
      formData.set("email", form.email)
      formData.set("address", form.address)
      formData.set("website", form.website)
      formData.set("proposal_default_notes", form.proposal_default_notes)

      const result = await updateCompanySettingsAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Company details saved")
      await loadSettings()
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (fileList: FileList | null) => {
    if (!fileList?.length) return

    setLogoUploading(true)
    try {
      const formData = new FormData()
      formData.set("logo", fileList[0])

      const result = await uploadCompanyLogoAction(formData)
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Company logo updated")
      await loadSettings()
      if (fileInputRef.current) fileInputRef.current.value = ""
    } finally {
      setLogoUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    setLogoUploading(true)
    try {
      const result = await removeCompanyLogoAction()
      if (!result.ok) {
        toast.error(result.error)
        return
      }

      toast.success("Company logo removed")
      await loadSettings()
    } finally {
      setLogoUploading(false)
    }
  }

  const logoPreview = settings?.logo_url ?? DEFAULT_LOGO

  return (
    <PageShell>
      <DashboardHeader />
      <PageMain>
        <PageHeader
          title="Company Details"
          description="Manage branding and contact information used across the app and on watermarked site photos."
        >
          <Button variant="outline" size="icon" asChild>
            <Link href="/admin" aria-label="Back to admin dashboard">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
        </PageHeader>

        {loading ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <Card className="section-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  Business information
                </CardTitle>
                <CardDescription>
                  Company name and phone are required for internal users to upload
                  watermarked site photos.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Company name *</Label>
                  <Input
                    id="company_name"
                    value={form.company_name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, company_name: e.target.value }))
                    }
                    placeholder="VRA Construction"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number *</Label>
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="info@vraconstruction.app"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={form.website}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, website: e.target.value }))
                    }
                    placeholder="https://vraconstruction.app"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    rows={3}
                    value={form.address}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="Office address"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal_default_notes">Default proposal notes</Label>
                  <Textarea
                    id="proposal_default_notes"
                    rows={6}
                    value={form.proposal_default_notes}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, proposal_default_notes: e.target.value }))
                    }
                    placeholder="Copied onto new proposals. Changing this later does not rewrite existing quotations."
                  />
                  <p className="text-xs text-muted-foreground">
                    New proposals copy these notes onto that version only. Existing proposals stay unchanged.
                  </p>
                </div>
                <Button onClick={() => void handleSave()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Save company details
                </Button>
              </CardContent>
            </Card>

            <Card className="section-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  Company logo
                </CardTitle>
                <CardDescription>
                  Shown in the sidebar and login screen. JPG, PNG, WebP, or SVG up to 2MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <img
                    src={logoPreview}
                    alt="Company logo preview"
                    className="h-20 w-20 rounded-xl border border-border object-cover shadow-sm"
                  />
                  <div className="space-y-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => void handleLogoUpload(e.target.files)}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={logoUploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {logoUploading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="mr-2 h-4 w-4" />
                      )}
                      Upload logo
                    </Button>
                    {settings?.logo_url ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={logoUploading}
                        onClick={() => void handleRemoveLogo()}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </PageMain>
    </PageShell>
  )
}
