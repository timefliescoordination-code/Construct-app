"use client"

import Link from "next/link"
import { Building2, ChevronRight, Users, Wallet } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const adminLinks = [
  {
    href: "/admin/company",
    title: "Company Details",
    description: "Company name, phone, logo, and contact info for branding and site photos.",
    icon: Building2,
    highlight: true,
  },
  {
    href: "/admin/users",
    title: "User Management",
    description: "Create and manage admin, PM, engineer, and customer accounts.",
    icon: Users,
  },
  {
    href: "/admin/expenses",
    title: "All Expenses",
    description: "Company-wide expense ledger and finance categories.",
    icon: Wallet,
  },
]

export function AdminSettingsLinks() {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Administration</h2>
        <p className="text-sm text-muted-foreground">
          Company profile, users, and finance settings
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {adminLinks.map((item) => {
          const Icon = item.icon
          return (
            <Card
              key={item.href}
              className={
                item.highlight
                  ? "border-primary/30 bg-primary/5 shadow-sm"
                  : "section-card"
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-primary" />
                  {item.title}
                </CardTitle>
                <CardDescription className="text-xs leading-relaxed">
                  {item.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                  <Link href={item.href}>
                    Open
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
