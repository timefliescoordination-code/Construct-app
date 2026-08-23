"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
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
  /** Reload user/profile after server-side sign-in (AuthProvider does not remount on router.push). */
  refreshAuth: () => Promise<void>
  canEnterData: boolean
  isAdmin: boolean
  canManageProjects: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

async function fetchSessionFromApi(): Promise<{
  user: User
  profile: UserProfile
} | null> {
  try {
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      cache: "no-store",
    })
    const json = await res.json()
    if (json.user && json.profile) {
      return {
        user: { id: json.user.id, email: json.user.email ?? "" } as User,
        profile: json.profile as UserProfile,
      }
    }
  } catch (error) {
    console.error("Error loading session from API:", error)
  }
  return null
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    profile: null,
    isLoading: true,
    isAuthenticated: false,
    role: null,
  })

  const refreshAuth = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'auth-provider.tsx:refreshAuth:start',message:'refreshAuth called',data:{browserConfigured:isSupabaseConfiguredForBrowser()},timestamp:Date.now(),hypothesisId:'H1-H3'})}).catch(()=>{});
    // #endregion
    setAuthState((prev) => {
      // #region agent log
      fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'auth-provider.tsx:refreshAuth:setLoading',message:'setting isLoading true',data:{prevIsAuthenticated:prev.isAuthenticated,prevIsLoading:prev.isLoading},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return { ...prev, isLoading: true }
    })

    try {
    if (!isSupabaseConfiguredForBrowser()) {
      const session = await fetchSessionFromApi()
      if (session) {
        setAuthState({
          user: session.user,
          profile: session.profile,
          isLoading: false,
          isAuthenticated: true,
          role: session.profile.role ?? null,
        })
      } else {
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

    const applySession = async (user: User) => {
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

      const fromApi = await fetchSessionFromApi()
      if (fromApi) {
        setAuthState({
          user: fromApi.user,
          profile: fromApi.profile,
          isLoading: false,
          isAuthenticated: true,
          role: fromApi.profile.role ?? null,
        })
        return
      }

      setAuthState({
        user,
        profile: profile ?? null,
        isLoading: false,
        isAuthenticated: true,
        role: profile?.role ?? null,
      })
    }

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'auth-provider.tsx:refreshAuth:afterGetUser',message:'getUser completed',data:{hasUser:Boolean(user)},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    if (user) {
      await applySession(user)
      return
    }

    const fromApi = await fetchSessionFromApi()
    if (fromApi) {
      setAuthState({
        user: fromApi.user,
        profile: fromApi.profile,
        isLoading: false,
        isAuthenticated: true,
        role: fromApi.profile.role ?? null,
      })
      return
    }

    setAuthState({
      user: null,
      profile: null,
      isLoading: false,
      isAuthenticated: false,
      role: null,
    })
    // #region agent log
    fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'auth-provider.tsx:refreshAuth:done',message:'refreshAuth finished unauthenticated',data:{isLoading:false,isAuthenticated:false},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    } catch (error) {
      console.error('[refreshAuth]', error)
      setAuthState({
        user: null,
        profile: null,
        isLoading: false,
        isAuthenticated: false,
        role: null,
      })
    }
  }, [])

  useEffect(() => {
    let subscription: { unsubscribe: () => void } | undefined

    async function init() {
      await refreshAuth()

      if (!isSupabaseConfiguredForBrowser()) {
        return
      }

      const supabase = createClient()
      const {
        data: { subscription: sub },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        // #region agent log
        fetch('http://127.0.0.1:7406/ingest/d702b43b-4e46-403e-a16b-cd4a4de78fb9',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'afacb8'},body:JSON.stringify({sessionId:'afacb8',location:'auth-provider.tsx:onAuthStateChange',message:'auth state change',data:{event,hasSession:Boolean(session)},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
        // #endregion
        if (session?.user) {
          if (event === 'INITIAL_SESSION') return
          await refreshAuth()
        } else if (event === "SIGNED_OUT") {
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
  }, [refreshAuth])

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
        refreshAuth,
        ...permissions,
      }
    }

    const supabase = createClient()

    return {
      ...authState,
      signIn: (email: string, password: string) =>
        supabase.auth.signInWithPassword({ email, password }),
      signOut: () => supabase.auth.signOut(),
      refreshAuth,
      ...permissions,
    }
  }, [authState, refreshAuth])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
