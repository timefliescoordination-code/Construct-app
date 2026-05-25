"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfiguredForBrowser } from "@/lib/supabase/env"
import type { User } from "@supabase/supabase-js"

export type UserRole = "admin" | "pm" | "engineer" | "customer"

export interface UserProfile {
  id: string
  email: string
  full_name: string
  role: UserRole
  phone?: string
  company_name?: string
}

export interface AuthState {
  user: User | null
  profile: UserProfile | null
  isLoading: boolean
  isAuthenticated: boolean
  role: UserRole | null
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => ReturnType<ReturnType<typeof createClient>["auth"]["signInWithPassword"]>
  signOut: () => ReturnType<ReturnType<typeof createClient>["auth"]["signOut"]>
  canEnterData: boolean
  isAdmin: boolean
  canManageProjects: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
    role: null,
  })

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined

    async function loadFromSessionApi() {
      try {
        const res = await fetch("/api/auth/session", { credentials: "include" })
        const json = await res.json()
        if (json.user && json.profile) {
          setAuthState({
            user: { id: json.user.id, email: json.user.email ?? "" } as User,
            profile: json.profile,
            isLoading: false,
            isAuthenticated: true,
            role: json.profile.role ?? null,
          })
          return true
        }
      } catch (error) {
        console.error("Error loading session from API:", error)
      }
      return false
    }

    async function init() {
      if (!isSupabaseConfiguredForBrowser()) {
        const loaded = await loadFromSessionApi()
        if (!loaded) {
          setAuthState({
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
            role: null,
          })
        }
        return
      }

      const supabase = createClient()

      async function loadProfile(user: User) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single()

        if (profile?.role) {
          setAuthState({
            user,
            profile,
            isLoading: false,
            isAuthenticated: true,
            role: profile.role,
          })
          return
        }

        const loaded = await loadFromSessionApi()
        if (!loaded) {
          setAuthState({
            user,
            profile: profile ?? null,
            isLoading: false,
            isAuthenticated: true,
            role: profile?.role ?? null,
          })
        }
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (user) {
          await loadProfile(user)
        } else {
          setAuthState({
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
            role: null,
          })
        }
      } catch (error) {
        console.error("Error getting session:", error)
        await loadFromSessionApi()
        setAuthState((prev) =>
          prev.isAuthenticated
            ? prev
            : {
                user: null,
                profile: null,
                isLoading: false,
                isAuthenticated: false,
                role: null,
              },
        )
      }

      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await loadProfile(session.user)
        } else {
          setAuthState({
            user: null,
            profile: null,
            isLoading: false,
            isAuthenticated: false,
            role: null,
          })
        }
      })
      subscription = sub
    }

    init()

    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const role = authState.role
    const permissions = {
      canEnterData: role === "admin" || role === "pm" || role === "engineer",
      isAdmin: role === "admin",
      canManageProjects: role === "admin" || role === "pm",
    }
    const notConfiguredError = {
      data: { user: null, session: null },
      error: {
        message:
          "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel (or .env.local locally).",
      },
    } as const

    if (!isSupabaseConfiguredForBrowser()) {
      return {
        ...authState,
        signIn: async () => notConfiguredError,
        signOut: async () => {
          window.location.href = "/auth/signout"
          return { error: null }
        },
        ...permissions,
      }
    }

    const supabase = createClient()

    return {
      ...authState,
      signIn: (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
      ...permissions,
    }
  }, [authState])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
