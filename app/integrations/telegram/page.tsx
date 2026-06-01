import type { Metadata } from "next"
import { TelegramIntegrationPage } from "@/components/telegram/telegram-integration-page"

export const metadata: Metadata = {
  title: "Telegram | VRA HOMES",
  description: "Connect Telegram to log site expenses from your phone",
}

export default function TelegramIntegrationRoute() {
  return <TelegramIntegrationPage />
}
