"use client"

import useSWR from "swr"
import type { AdminDashboardData } from "@/lib/admin-dashboard-data"

async function fetchAdminDashboard(): Promise<AdminDashboardData> {
  const response = await fetch("/api/admin/dashboard")
  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.error ?? "Failed to load admin dashboard")
  }
  return response.json()
}

export function useAdminDashboard() {
  const { data, error, isLoading, mutate } = useSWR("admin-dashboard", fetchAdminDashboard, {
    revalidateOnFocus: false,
  })

  return {
    data,
    projects: data?.projects ?? [],
    company: data?.company,
    projectManagers: data?.projectManagers ?? [],
    siteEngineers: data?.siteEngineers ?? [],
    isLoading,
    error,
    mutate,
  }
}
