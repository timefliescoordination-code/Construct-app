"use client"

import Link from "next/link"
import type { ComponentType } from "react"
import {
  LayoutDashboard,
  Receipt,
  CreditCard,
  Flag,
  Users,
  PlusCircle,
  FileBarChart,
  Camera,
  Settings,
  FolderKanban,
  UserCog,
  Target,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/hooks/use-auth"
import { BrandLogo } from "@/components/layout/brand-logo"
import { useCompanyBranding } from "@/lib/hooks/use-company-branding"

export interface ProjectSidebarTab {
  id: string
  label: string
  icon: ComponentType<{ className?: string }>
}

interface ProjectSidebarProps {
  tabs: ProjectSidebarTab[]
  activeTab: string
  onTabChange: (tabId: string) => void
  projectId: string
  canManageProjects?: boolean
  className?: string
  onNavigate?: () => void
}

const settingsLinks = (projectId: string, canManageProjects?: boolean) => [
  { href: `/projects/${projectId}/edit`, label: "Project Details", icon: FolderKanban },
  ...(canManageProjects
    ? [
        { href: `/projects/${projectId}/edit`, label: "Team Members", icon: UserCog },
        { href: `/projects/${projectId}/edit`, label: "Budget & Targets", icon: Target },
        { href: `/projects/${projectId}/edit`, label: "Settings", icon: Settings },
      ]
    : []),
]

export function ProjectSidebar({
  tabs,
  activeTab,
  onTabChange,
  projectId,
  canManageProjects,
  className,
  onNavigate,
}: ProjectSidebarProps) {
  const { role } = useAuth()
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

  const handleTab = (tabId: string) => {
    onTabChange(tabId)
    onNavigate?.()
  }

  return (
    <aside
      className={cn(
        "flex h-full w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="border-b border-sidebar-border px-4 py-5">
        <Link
          href={dashboardHref}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-3 rounded-lg transition-opacity hover:opacity-90"
        >
          <BrandLogo
            src={branding.logo_url}
            alt={branding.company_name ?? "VRA HOMES"}
            size={36}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">VRA HOMES</p>
            <p className="text-[11px] text-muted-foreground">Build Unique One</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Main
        </p>
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTab(tab.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{tab.label}</span>
            </button>
          )
        })}

        <p className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Project Settings
        </p>
        {settingsLinks(projectId, canManageProjects).map((link) => {
          const Icon = link.icon
          return (
            <Link
              key={`${link.label}-${link.href}`}
              href={link.href}
              onClick={onNavigate}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-start gap-2">
            <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-foreground">Need Help?</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Contact your admin for project support.
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

export function ProjectSidebarMobileTrigger({
  onClick,
  className,
}: {
  onClick: () => void
  className?: string
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("gap-2 lg:hidden", className)}
      onClick={onClick}
    >
      <LayoutDashboard className="h-4 w-4" />
      Menu
    </Button>
  )
}
