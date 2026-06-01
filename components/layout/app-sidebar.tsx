"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"

interface AppSidebarProps {
  className?: string
  onNavigate?: () => void
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const { role } = useAuth()

  const dashboardHref =
    role === "admin"
      ? "/admin"
      : role === "pm"
        ? "/pm"
        : role === "engineer"
          ? "/engineer"
          : role === "customer"
            ? "/customer"
            : "/projects"

  const navItems = [
    { href: dashboardHref, label: "Dashboard", icon: LayoutDashboard },
    { href: "/projects", label: "Projects", icon: FolderKanban },
    ...(role === "admin"
      ? [{ href: "/admin/users", label: "User Management", icon: Users }]
      : []),
  ]

  const isActive = (href: string) => {
    if (href === "/projects") {
      return pathname === "/projects" || pathname.startsWith("/projects/")
    }
    if (href === "/admin") return pathname === "/admin"
    return pathname.startsWith(href)
  }

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-5">
        <Link href={dashboardHref} onClick={onNavigate} className="flex items-center gap-3">
          <img
            src="/images/vra-logo.png"
            alt="VRA HOMES"
            className="h-9 w-9 rounded-xl object-cover shadow-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">VRA HOMES</p>
            <p className="text-[11px] text-muted-foreground">Build Unique One</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Main
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold text-foreground">Need Help?</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                Contact your admin for support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
