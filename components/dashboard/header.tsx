"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Menu, Search, Shield, Users, Building2, Tags, Flag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"
import { dashboardPath } from "@/lib/auth/dashboard-path"
import { toast } from "sonner"
import type { AppNotification } from "@/lib/notifications"
import { formatDistanceToNow } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ThemeToggle } from "@/components/theme-toggle"

const roleLabels: Record<string, string> = {
  admin: "Admin",
  pm: "Project Manager",
  engineer: "Site Engineer",
  customer: "Customer",
}

const roleColors: Record<string, string> = {
  pm: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  engineer: "bg-green-500/20 text-green-400 border-green-500/30",
  customer: "bg-orange-500/20 text-orange-400 border-orange-500/30",
}

interface DashboardHeaderProps {
  /** Optional extra badge count (e.g. PM pending approvals on dashboard). */
  notificationCount?: number
  /** Hide app nav menu on mobile (project pages use their own sidebar). */
  hideAppNav?: boolean
}

export function DashboardHeader({ notificationCount = 0, hideAppNav = false }: DashboardHeaderProps) {
  const router = useRouter()
  const { profile, isLoading, signOut, role, isAuthenticated } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
      return
    }
    try {
      const res = await fetch("/api/notifications", {
        credentials: "include",
        cache: "no-store",
      })
      const json = (await res.json().catch(() => ({}))) as {
        data?: AppNotification[]
        unreadCount?: number
      }
      if (res.ok) {
        setNotifications(json.data ?? [])
        setUnreadCount(json.unreadCount ?? 0)
      }
    } catch {
      // notifications table may not exist yet
    }
  }, [isAuthenticated])

  useEffect(() => {
    void loadNotifications()
    const interval = setInterval(() => void loadNotifications(), 60_000)
    return () => clearInterval(interval)
  }, [loadNotifications])

  const badgeCount = Math.max(unreadCount, notificationCount)

  const getDashboardHome = () => dashboardPath(role)

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (error) {
      toast.error("Failed to sign out")
    } else {
      toast.success("Signed out successfully")
      router.push("/login")
    }
  }

  const getInitials = (name?: string) => {
    if (!name) return "U"
    const parts = name.split(" ")
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read_at) {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: notification.id }),
      })
      void loadNotifications()
    }

    if (role === "customer" && notification.link_path) {
      router.push(notification.link_path)
      return
    }

    if (notification.project_id) {
      router.push(`/projects/${notification.project_id}`)
    }
  }

  const handleMarkAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    })
    void loadNotifications()
  }

  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 pt-[env(safe-area-inset-top)] shadow-sm">
      <div className="mx-auto flex h-14 min-h-14 max-w-[1600px] items-center justify-between gap-2 px-4 sm:h-16 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          {!hideAppNav && (
          <div className="md:hidden">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[min(100vw-2rem,18rem)] p-0"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <AppSidebar
                className="h-full w-full border-0"
                onNavigate={() => setMobileNavOpen(false)}
              />
            </SheetContent>
          </Sheet>
          </div>
          )}

          <Link href={getDashboardHome()} className="flex min-w-0 items-center gap-2 lg:hidden">
            <img
              src="/images/vra-logo.png"
              alt="VRA HOMES"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="truncate font-semibold text-sm">VRA HOMES</span>
          </Link>

          {isLoading ? (
            <Badge variant="outline" className="hidden sm:inline-flex text-muted-foreground">
              ...
            </Badge>
          ) : role === "admin" ? (
            <Badge variant="outline" className="hidden shrink-0 border-primary text-primary text-xs lg:inline-flex">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          ) : role ? (
            <Badge variant="outline" className={cn("hidden lg:inline-flex", roleColors[role] || "")}>
              {roleLabels[role] || role}
            </Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <div className="relative hidden xl:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="w-56 pl-9 bg-background border-border"
            />
          </div>

          <ThemeToggle />

          <DropdownMenu onOpenChange={(open) => open && void loadNotifications()}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
              >
                <Bell className="h-5 w-5" />
                {badgeCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                    {badgeCount > 9 ? "9+" : badgeCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[min(calc(100vw-2rem),20rem)] sm:w-80">
              <DropdownMenuLabel className="flex items-center justify-between">
                <span>Notifications</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => void handleMarkAllRead()}
                  >
                    Mark all read
                  </button>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length === 0 ? (
                <p className="px-2 py-4 text-sm text-muted-foreground text-center">
                  No notifications yet
                </p>
              ) : (
                notifications.slice(0, 8).map((notification) => (
                  <DropdownMenuItem
                    key={notification.id}
                    className={cn(
                      "flex flex-col items-start gap-1 cursor-pointer py-2",
                      !notification.read_at && "bg-primary/5",
                    )}
                    onClick={() => void handleNotificationClick(notification)}
                  >
                    <span className="font-medium text-sm">{notification.title}</span>
                    <span className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </span>
                    <div className="flex w-full items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                      {(notification.link_path || notification.project_id) && (
                        <span className="text-[10px] font-medium text-primary">View</span>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                <Avatar className="h-9 w-9">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {isLoading ? "..." : getInitials(profile?.full_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">
                    {isLoading ? "Loading..." : profile?.full_name || "Guest"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profile?.email || "Not signed in"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {role === "admin" && (
                <>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/company">
                      <Building2 className="mr-2 h-4 w-4" />
                      Company Details
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings/expense-input">
                      <Tags className="mr-2 h-4 w-4" />
                      Manage expense input
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/settings/milestones">
                      <Flag className="mr-2 h-4 w-4" />
                      Milestones
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/admin/users">
                      <Users className="mr-2 h-4 w-4" />
                      User Management
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}
              {profile ? (
                <DropdownMenuItem onClick={handleSignOut}>Log out</DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href="/login">Log in</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
