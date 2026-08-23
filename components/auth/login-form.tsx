"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { UserRole } from "@/lib/hooks/use-auth"
import { useAuth } from "@/lib/hooks/use-auth"
import Link from "next/link"
import { Eye, EyeOff, HardHat, User, Users, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { dashboardPath } from "@/lib/auth/dashboard-path"
import { toast } from "sonner"

interface RoleOption {
  id: UserRole
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const roles: RoleOption[] = [
  {
    id: "customer",
    label: "Customer",
    description: "View project progress & invoices",
    icon: User,
  },
  {
    id: "engineer",
    label: "Engineer",
    description: "Manage tasks & site reports",
    icon: HardHat,
  },
  {
    id: "pm",
    label: "Project Manager",
    description: "Manage assigned projects",
    icon: Users,
  },
  {
    id: "admin",
    label: "Admin",
    description: "Company-wide oversight",
    icon: Shield,
  },
]

export function LoginForm() {
  const router = useRouter()
  const {
    isAuthenticated,
    isLoading: authLoading,
    role,
    profile,
    signOut,
    refreshAuth,
  } = useAuth()

  const [selectedRole, setSelectedRole] = useState<UserRole>("pm")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    rememberMe: false,
  })

  const handleSignOut = async () => {
    setIsLoading(true)
    const { error } = await signOut()
    if (error) {
      toast.error("Failed to sign out")
      setIsLoading(false)
      return
    }
    toast.success("Signed out")
    router.refresh()
    setIsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      })
      const result = await loginRes.json()

      if (!result.ok) {
        toast.error(result.error ?? "Sign in failed.")
        setIsLoading(false)
        return
      }

      toast.success("Signed in successfully!")
      const target = result.redirectTo ?? dashboardPath(result.role)
      // Full navigation so new session cookies from /api/auth/login are sent on the next request.
      window.location.assign(target)
      return
    } catch (error) {
      console.error("Login error:", error)
      const message =
        error instanceof Error ? error.message : "An unexpected error occurred"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  if (isAuthenticated && !authLoading) {
    const displayName = profile?.full_name || profile?.email || "your account"
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-3 text-center">
          <img
            src="/images/vra-logo.png"
            alt="VRA HOMES"
            className="h-16 w-16 rounded-xl object-cover"
          />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">VRA HOMES</h1>
            <p className="text-sm text-muted-foreground">Build Unique One</p>
          </div>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl text-center">Already signed in</CardTitle>
            <CardDescription className="text-center">
              You are logged in as {displayName}
              {role ? ` (${role})` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              size="lg"
              onClick={async () => {
                await refreshAuth()
                router.push(dashboardPath(role))
                router.refresh()
              }}
            >
              Continue to dashboard
            </Button>
            <Button
              className="w-full"
              size="lg"
              variant="outline"
              disabled={isLoading}
              onClick={handleSignOut}
            >
              {isLoading ? "Signing out..." : "Sign out and use another account"}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* Logo & Title */}
      <div className="flex flex-col items-center space-y-3 text-center">
        <img 
          src="/images/vra-logo.png" 
          alt="VRA HOMES" 
          className="h-16 w-16 rounded-xl object-cover"
        />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            VRA HOMES
          </h1>
          <p className="text-sm text-muted-foreground">
            Build Unique One
          </p>
        </div>
      </div>

      {/* Login Card */}
      <Card className="border-border bg-card">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to access your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Role Selection (for display only - actual role comes from database) */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Login as</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {roles.map((role) => {
                  const Icon = role.icon
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.id)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border p-3 transition-all",
                        selectedRole === role.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/50 text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{role.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground text-center pt-1">
                {roles.find((r) => r.id === selectedRole)?.description}
              </p>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="bg-input border-border"
                required
              />
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 h-auto text-xs text-muted-foreground hover:text-primary"
                >
                  Forgot password?
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  className="bg-input border-border pr-10"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  <span className="sr-only">
                    {showPassword ? "Hide password" : "Show password"}
                  </span>
                </Button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="remember"
                checked={formData.rememberMe}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, rememberMe: checked === true })
                }
              />
              <Label
                htmlFor="remember"
                className="text-sm font-normal text-muted-foreground cursor-pointer"
              >
                Remember login
              </Label>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Signing in...
                </span>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {selectedRole === "admin" ? (
              <>
                {"Don't have an account? "}
                <Link href="/signup" className="text-primary hover:underline">
                  Sign up
                </Link>
              </>
            ) : (
              "Don't have an account? Contact your administrator."
            )}
          </div>
        </CardContent>
      </Card>

      {/* Copyright */}
      <p className="text-center text-xs text-muted-foreground">
        2024 VRA HOMES. All rights reserved.
      </p>
    </div>
  )
}
