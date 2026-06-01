"use client"

import useSWR from "swr"
import { createClient } from "@/lib/supabase/client"

async function fetchManpowerWeekStarts(projectId: string): Promise<string[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("manpower_weeks")
    .select("start_date")
    .eq("project_id", projectId)
    .order("start_date", { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => row.start_date)
}

export function useProjectManpowerWeekStarts(projectId: string | null) {
  const { data, error, isLoading } = useSWR(
    projectId ? `manpower-week-starts-${projectId}` : null,
    () => fetchManpowerWeekStarts(projectId!),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  )

  return {
    weekStarts: data ?? [],
    isLoading,
    error,
  }
}
