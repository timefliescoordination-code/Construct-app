"use client"

import { useEffect, useState } from "react"

export type CompanyBranding = {
  company_name: string | null
  logo_url: string | null
}

const DEFAULT_BRANDING: CompanyBranding = {
  company_name: "VRA HOMES",
  logo_url: "/images/vra-logo.png",
}

export function useCompanyBranding() {
  const [branding, setBranding] = useState<CompanyBranding>(DEFAULT_BRANDING)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const res = await fetch("/api/company/branding", { cache: "no-store" })
        const json = await res.json()
        if (!res.ok) return

        const data = json.data as CompanyBranding | undefined
        if (!cancelled && data) {
          setBranding({
            company_name: data.company_name?.trim() || DEFAULT_BRANDING.company_name,
            logo_url: data.logo_url || DEFAULT_BRANDING.logo_url,
          })
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  return { branding, isLoading }
}
