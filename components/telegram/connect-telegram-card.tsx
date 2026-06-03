"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, MessageCircle, Copy, Check, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import {
  createTelegramLinkCodeAction,
  getTelegramLinkStatusAction,
} from "@/lib/telegram/actions"
import { useAuth } from "@/lib/hooks/use-auth"

export function ConnectTelegramCard() {
  const { role } = useAuth()
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
      toast.success("Code ready — paste it in Telegram")
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
          <CardTitle className="text-base font-medium">Not available</CardTitle>
          <CardDescription>
            Telegram is not configured on the server yet. Ask your admin to enable it.
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
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            Connection
          </CardTitle>
          {isLinked ? (
            <Badge variant="outline" className="text-success border-success/30">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
        <CardDescription>
          One-time setup. After linking, log expenses in Telegram without signing in here
          each time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
          <li>
            Open the bot
            {botUsername && botUsername !== "YourBot" ? (
              <>
                {" "}
                (<span className="font-mono text-foreground">@{botUsername}</span>)
              </>
            ) : null}
          </li>
          <li>Tap <strong className="text-foreground">Get link code</strong> below</li>
          <li>
            In Telegram, send the copied message or paste only the 6-character code
          </li>
        </ol>

        {botLink ? (
          <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
            <a href={botLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open Telegram bot
            </a>
          </Button>
        ) : null}

        {code ? (
          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">Send in Telegram</p>
            <p className="font-mono text-base font-semibold tracking-wide">{linkMessage}</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={copyTelegramMessage}>
                {copiedMessage ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                Copy message
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyCode}>
                {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                Code only
              </Button>
            </div>
            {expiresAt ? (
              <p className="text-xs text-muted-foreground">
                Expires {new Date(expiresAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button
          type="button"
          variant={code ? "outline" : "default"}
          size="sm"
          onClick={generateCode}
          disabled={isPending}
        >
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {code ? "New code" : "Get link code"}
        </Button>

        {isLinked ? (
          <p className="text-xs text-muted-foreground">
            {role === "admin" ? (
              <>
                In Telegram use the menu: <strong className="text-foreground">Project</strong>,{" "}
                <strong className="text-foreground">Company</strong>, or{" "}
                <strong className="text-foreground">Personal</strong> expense. Quick:{" "}
                <span className="font-mono">company 5000 Office Rent June rent</span>
              </>
            ) : (
              <>
                Daily use: open Telegram and send <span className="font-mono">/expense</span> or{" "}
                <span className="font-mono">2500 Materials Cement bags</span>
              </>
            )}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
