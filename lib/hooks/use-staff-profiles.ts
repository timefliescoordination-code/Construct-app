"use client"

import useSWR from "swr"
import type { Profile } from "@/lib/types/database"

async function fetchStaffProfiles(): Promise<Profile[]> {
  const res = await fetch("/api/staff-profiles", { credentials: "include" })
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(
      typeof json.error === "string" ? json.error : `Request failed (${res.status})`,
    )
  }

  return (json.data ?? []) as Profile[]
}

export function useStaffProfiles() {
  const { data, error, isLoading, mutate } = useSWR("staff-profiles", fetchStaffProfiles)

  const profiles = data ?? []
  const projectManagers = profiles.filter((profile) => profile.role === "pm")
  const siteEngineers = profiles.filter((profile) => profile.role === "engineer")
  const customers = profiles.filter((profile) => profile.role === "customer")

  return {
    profiles,
    projectManagers,
    siteEngineers,
    customers,
    isLoading,
    error,
    mutate,
  }
}
