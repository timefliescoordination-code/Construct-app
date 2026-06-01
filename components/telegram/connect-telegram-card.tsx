"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, MessageCircle, Copy, Check, ExternalLink, Smartphone } from "lucide-react"
import { toast } from "sonner"
import {
  createTelegramLinkCodeAction,
  getTelegramLinkStatusAction,
} from "@/lib/telegram/actions"

export function ConnectTelegramCard() {
  const [configured, setConfigured] = useState(false)
  const [isLinked, setIsLinked] = useState(false)
  const [botUsername, setBotUsername] = useState("")
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [isPending, startTransition] = useTransition()

  const refreshStatus = useCallback(async () => {
    const status = await getTelegramLinkStatusAction()
    setConfigured(status.configured)
    setIsLinked(status.isLinked)
    setBotUsername(status.botUsername)
  }, [])

  useEffect(() => {
    void refreshStatus()
  }, [refreshStatus])

  const generateCode = () => {
    startTransition(async () => {
      const result = await createTelegramLinkCodeAction()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setCode(result.code)
      setExpiresAt(result.expiresAt)
      setIsLinked(result.isLinked)
      setBotUsername(result.botUsername)
      toast.success("Code ready — open Telegram and send the message below")
    })
  }

  const copyCode = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopiedCode(true)
    toast.success("Code copied")
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const linkMessage = code ? `/link ${code}` : ""

  const copyTelegramMessage = async () => {
    if (!linkMessage) return
    await navigator.clipboard.writeText(linkMessage)
    setCopiedMessage(true)
    toast.success("Copied — paste in Telegram chat")
    setTimeout(() => setCopiedMessage(false), 2000)
  }

  if (!configured) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Telegram expenses (site engineers)
          </CardTitle>
          <CardDescription>
            Not active yet. Admin must add TELEGRAM_BOT_TOKEN in Vercel, then redeploy.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const botLink =
    botUsername && botUsername !== "YourBot"
      ? `https://t.me/${botUsername}`
      : null

  return (
    <Card className="border-2 border-primary/20 bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="h-5 w-5 text-primary" />
            Connect Telegram (log expenses from phone)
          </CardTitle>
          {isLinked ? (
            <Badge className="bg-success/15 text-success border-success/30">Connected</Badge>
          ) : (
            <Badge variant="outline">Not connected yet</Badge>
          )}
        </div>
        <CardDescription>
          Do this once. After that, engineers can send expenses in Telegram without opening
          this website every time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <p className="font-medium text-foreground">Where engineers find this</p>
          <p className="mt-1 text-muted-foreground">
            Website login → <strong>Engineer dashboard</strong> → this card at the top.
            Share your app link and their email/password (or how they usually sign in).
          </p>
        </div>

        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </span>
            <span>
              Install <strong>Telegram</strong> on the phone (App Store / Play Store) if not
              already installed.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </span>
            <span>
              Tap the button below to open the <strong>VRA expense bot</strong>
              {botUsername && botUsername !== "YourBot" ? (
                <>
                  {" "}
                  (<span className="font-mono">@{botUsername}</span>)
                </>
              ) : null}
              .
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </span>
            <span>
              On this page, tap <strong>Get link code</strong>, then in Telegram tap{" "}
              <strong>Copy message</strong> and send it in the bot chat (or type the code
              only).
            </span>
          </li>
        </ol>

        {botLink ? (
          <Button type="button" className="w-full gap-2" asChild>
            <a href={botLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Telegram bot
            </a>
          </Button>
        ) : (
          <p className="text-xs text-destructive">
            Set NEXT_PUBLIC_TELEGRAM_BOT_USERNAME in Vercel so the Open bot button appears.
          </p>
        )}

        {code ? (
          <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Step 3 — send this in Telegram
            </p>
            <p className="font-mono text-lg font-bold tracking-wide">{linkMessage}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="default" size="sm" onClick={copyTelegramMessage}>
                {copiedMessage ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy message for Telegram
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyCode}>
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Code only
              </Button>
            </div>
            {expiresAt ? (
              <p className="text-xs text-muted-foreground">
                Code expires {new Date(expiresAt).toLocaleString()} — generate a new one if
                needed.
              </p>
            ) : null}
          </div>
        ) : null}

        <Button
          type="button"
          variant={code ? "outline" : "default"}
          className="w-full"
          onClick={generateCode}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {code ? "Get a new code" : "Get link code"}
        </Button>

        {isLinked ? (
          <p className="text-center text-xs text-success">
            This account is connected. To log an expense in Telegram, send /expense or e.g.{" "}
            <span className="font-mono">2500 Materials Cement bags</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
