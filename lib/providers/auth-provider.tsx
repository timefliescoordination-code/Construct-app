"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
    const supabase = createClient()

    async function loadProfile(user: User) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single()

      setAuthState({
        user,
        profile,
        isLoading: false,
        isAuthenticated: true,
        role: profile?.role || null,
      })
    }

    async function getInitialSession() {
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
        setAuthState({
          user: null,
          profile: null,
          isLoading: false,
          isAuthenticated: false,
          role: null,
        })
      }
    }

    getInitialSession()

    const {
      data: { subscription },
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

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => {
    const supabase = createClient()
    const role = authState.role

    return {
      ...authState,
      signIn: (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
      canEnterData: role === "admin" || role === "pm" || role === "engineer",
      isAdmin: role === "admin",
      canManageProjects: role === "admin" || role === "pm",
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
