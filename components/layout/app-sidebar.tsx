"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  HelpCircle,
  MessageCircle,
  Wallet,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"
import { useCompanyBranding } from "@/lib/hooks/use-company-branding"

interface AppSidebarProps {
  className?: string
  onNavigate?: () => void
}

export function AppSidebar({ className, onNavigate }: AppSidebarProps) {
  const pathname = usePathname()
  const { role, isAdmin } = useAuth()
  const { branding } = useCompanyBranding()

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
    {
      href: dashboardHref,
      label: role === "customer" ? "My Project" : "Dashboard",
      icon: LayoutDashboard,
    },
    ...(role !== "customer"
      ? [{ href: "/projects", label: "Projects", icon: FolderKanban }]
      : []),
    ...(role === "admin"
      ? [{ href: "/admin/expenses", label: "All expenses", icon: Wallet }]
      : []),
  ]

  const adminNavItems = isAdmin
    ? [
        { href: "/admin/company", label: "Company Details", icon: Building2 },
        { href: "/admin/users", label: "User Management", icon: Users },
      ]
    : []

  const canUseTelegram =
    role === "engineer" || role === "pm" || role === "admin"

  const integrationItems = canUseTelegram
    ? [{ href: "/integrations/telegram", label: "Telegram", icon: MessageCircle }]
    : []

  const isActive = (href: string) => {
    if (href === "/projects") {
      return pathname === "/projects" || pathname.startsWith("/projects/")
    }
    if (href === "/admin") {
      return pathname === "/admin"
    }
    if (href === "/admin/expenses") {
      return pathname.startsWith("/admin/expenses")
    }
    if (href === "/admin/company") {
      return pathname.startsWith("/admin/company")
    }
    return pathname.startsWith(href)
  }

  const renderNavLink = (item: {
    href: string
    label: string
    icon: typeof LayoutDashboard
  }) => {
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
            src={branding.logo_url ?? "/images/vra-logo.png"}
            alt={branding.company_name ?? "VRA HOMES"}
            className="h-9 w-9 rounded-xl object-cover shadow-sm"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {branding.company_name ?? "VRA HOMES"}
            </p>
            <p className="text-[11px] text-muted-foreground">Build Unique One</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Main
        </p>
        {navItems.map(renderNavLink)}
        {adminNavItems.length > 0 ? (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Administration
            </p>
            {adminNavItems.map(renderNavLink)}
          </>
        ) : null}
        {integrationItems.length > 0 ? (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Integrations
            </p>
            {integrationItems.map(renderNavLink)}
          </>
        ) : null}
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
