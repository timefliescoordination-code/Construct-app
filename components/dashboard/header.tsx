"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, Menu, Search, Shield, Users } from "lucide-react"
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
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"
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
}

export function DashboardHeader({ notificationCount = 0 }: DashboardHeaderProps) {
  const pathname = usePathname()
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

  const getDashboardHome = () => {
    switch (role) {
      case "admin":
        return "/admin"
      case "pm":
        return "/pm"
      case "engineer":
        return "/engineer"
      case "customer":
        return "/customer"
      default:
        return "/"
    }
  }

  const navItems = [
    { href: getDashboardHome(), label: "Dashboard" },
    { href: "/projects", label: "Projects" },
  ]

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

  const isNavActive = (href: string) => {
    if (href === "/projects") {
      return pathname === "/projects" || pathname.startsWith("/projects/")
    }
    if (href === "/admin") {
      return pathname === "/admin"
    }
    return pathname === href
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
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 min-h-14 items-center justify-between gap-2 px-4 sm:h-16 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4 md:gap-6">
          <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex h-full w-[min(100vw-2rem,20rem)] flex-col gap-0 p-0"
            >
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle className="text-base">VRA HOMES</SheetTitle>
                <p className="text-xs text-muted-foreground font-normal">
                  Build Unique One
                </p>
              </SheetHeader>
              <nav className="flex flex-col gap-1 p-3">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isNavActive(item.href)
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
                {role === "admin" && (
                  <Link
                    href="/admin/users"
                    onClick={() => setMobileNavOpen(false)}
                    className={cn(
                      "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      pathname.startsWith("/admin/users")
                        ? "bg-primary/10 text-primary"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    User Management
                  </Link>
                )}
              </nav>
              {role && role !== "admin" && (
                <div className="mt-auto border-t border-border p-4">
                  <Badge variant="outline" className={cn("w-fit", roleColors[role] || "")}>
                    {roleLabels[role] || role}
                  </Badge>
                </div>
              )}
            </SheetContent>
          </Sheet>

          <Link href={getDashboardHome()} className="flex min-w-0 items-center gap-2">
            <img
              src="/images/vra-logo.png"
              alt="VRA HOMES"
              className="h-9 w-9 rounded-lg object-cover"
            />
            <div className="hidden sm:flex flex-col">
              <span className="font-bold text-foreground text-sm leading-tight">
                VRA HOMES
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Build Unique One
              </span>
            </div>
          </Link>

          {isLoading ? (
            <Badge variant="outline" className="hidden sm:inline-flex text-muted-foreground">
              ...
            </Badge>
          ) : role === "admin" ? (
            <Badge variant="outline" className="shrink-0 border-primary text-primary text-xs">
              <Shield className="h-3 w-3 mr-1" />
              Admin
            </Badge>
          ) : role ? (
            <Badge variant="outline" className={cn("hidden sm:inline-flex", roleColors[role] || "")}>
              {roleLabels[role] || role}
            </Badge>
          ) : null}

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  isNavActive(item.href)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-4">
          <div className="relative hidden lg:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search..."
              className="w-64 pl-9 bg-secondary border-border"
            />
          </div>

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
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </span>
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
