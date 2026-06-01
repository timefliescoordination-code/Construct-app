"use client"

import { DashboardHeader } from "@/components/dashboard/header"
import { ConnectTelegramCard } from "@/components/telegram/connect-telegram-card"
import { PageHeader, PageMain, PageShell } from "@/components/layout/page"

export function TelegramIntegrationPage() {
  return (
    <PageShell>
      <DashboardHeader />
      <PageMain narrow>
        <PageHeader
          title="Telegram"
          description="Link your account once, then submit site expenses from the Telegram bot."
        />
        <ConnectTelegramCard />
      </PageMain>
    </PageShell>
  )
}
