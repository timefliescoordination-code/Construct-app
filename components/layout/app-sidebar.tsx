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
  FileText,
  ClipboardList,
  Settings,
  Tags,
  Flag,
  ChevronDown,
  HardHat,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/lib/hooks/use-auth"
import { useCompanyBranding } from "@/lib/hooks/use-company-branding"
import { BrandLogo } from "@/components/layout/brand-logo"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

interface AppSidebarProps {
  className?: string
  onNavigate?: () => void
}

type NavItem = {
  id: string
  href: string
  label: string
  icon: typeof LayoutDashboard
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

  const canUseTelegram =
    role === "engineer" || role === "pm" || role === "admin"

  const mainNavItems: NavItem[] = [
    {
      id: "dashboard",
      href: dashboardHref,
      label: role === "customer" ? "My Project" : "Dashboard",
      icon: LayoutDashboard,
    },
    ...(role !== "customer"
      ? [
          { id: "projects", href: "/projects", label: "Projects", icon: FolderKanban },
          ...(role === "admin" || role === "pm"
            ? [
                {
                  id: "proposals",
                  href: "/proposals",
                  label: "Proposals",
                  icon: FileText,
                },
              ]
            : []),
          ...(role === "admin" || role === "pm" || role === "engineer"
            ? [
                {
                  id: "change-requests",
                  href: "/change-requests",
                  label: "Change requests",
                  icon: ClipboardList,
                },
              ]
            : []),
        ]
      : []),
    ...(role === "admin"
      ? [{ id: "expenses", href: "/admin/expenses", label: "All expenses", icon: Wallet }]
      : []),
  ]

  const adminNavItems: NavItem[] = isAdmin
    ? [{ id: "users", href: "/admin/users", label: "User Management", icon: Users }]
    : []

  const settingsItems: NavItem[] = isAdmin
    ? [
        { id: "company", href: "/admin/company", label: "Company details", icon: Building2 },
        {
          id: "expense-input",
          href: "/admin/settings/expense-input",
          label: "Manage expense input",
          icon: Tags,
        },
        {
          id: "milestones",
          href: "/admin/settings/milestones",
          label: "Milestones",
          icon: Flag,
        },
        {
          id: "labours",
          href: "/admin/settings/labours",
          label: "Manage labours",
          icon: HardHat,
        },
      ]
    : []

  const integrationItems: NavItem[] = canUseTelegram
    ? [
        {
          id: "telegram",
          href: "/integrations/telegram",
          label: "Telegram",
          icon: MessageCircle,
        },
      ]
    : []

  const dedupeNavItems = (items: NavItem[]) => {
    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.href)) return false
      seen.add(item.href)
      return true
    })
  }

  const mainNavItemsDeduped = dedupeNavItems(mainNavItems)

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
    if (href === "/change-requests") {
      return pathname.startsWith("/change-requests")
    }
    if (href === "/proposals") {
      return pathname.startsWith("/proposals")
    }
    if (href === "/admin/company") {
      return pathname.startsWith("/admin/company")
    }
    if (href === "/admin/settings/expense-input") {
      return pathname.startsWith("/admin/settings/expense-input")
    }
    if (href === "/admin/settings/milestones") {
      return pathname.startsWith("/admin/settings/milestones")
    }
    return pathname.startsWith(href)
  }

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon
    const active = isActive(item.href)
    return (
      <Link
        key={item.id}
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
        "flex w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-5">
        <Link href={dashboardHref} onClick={onNavigate} className="flex min-w-0 items-center gap-3">
          <BrandLogo
            src={branding.logo_url}
            alt={branding.company_name ?? "VRA HOMES"}
            size={36}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">
              {branding.company_name ?? "VRA HOMES"}
            </p>
            <p className="text-[11px] text-muted-foreground">Build Unique One</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Main
        </p>
        {mainNavItemsDeduped.map(renderNavLink)}
        {isAdmin ? (
          <>
            <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Administration
            </p>
            <Collapsible
              defaultOpen={
                pathname.startsWith("/admin/company") ||
                pathname.startsWith("/admin/settings")
              }
            >
              <CollapsibleTrigger
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname.startsWith("/admin/company") ||
                    pathname.startsWith("/admin/settings")
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Settings className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">Settings</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1 space-y-1 pl-3">
                {settingsItems.map(renderNavLink)}
              </CollapsibleContent>
            </Collapsible>
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

      <div className="shrink-0 border-t border-sidebar-border p-3">
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
