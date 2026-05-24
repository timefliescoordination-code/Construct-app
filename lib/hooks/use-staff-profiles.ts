"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"
import type { Profile } from "@/lib/types/database"
import { getSupabaseErrorMessage } from "@/lib/supabase/db-errors"

async function fetchStaffProfiles(): Promise<Profile[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, role, phone, company_name, created_at, updated_at")
    .in("role", ["pm", "engineer", "customer"])
    .order("full_name", { ascending: true })

  if (error) {
    throw new Error(getSupabaseErrorMessage(error))
  }

  return (data ?? []) as Profile[]
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
