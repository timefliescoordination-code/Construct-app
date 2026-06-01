"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, MessageCircle, Copy, Check } from "lucide-react"
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
  const [copied, setCopied] = useState(false)
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
      toast.success("Link code generated — valid for 15 minutes")
    })
  }

  const copyCode = async () => {
    if (!code) return
    await navigator.clipboard.writeText(code)
    setCopied(true)
    toast.success("Code copied")
    setTimeout(() => setCopied(false), 2000)
  }

  if (!configured) {
    return (
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Telegram expenses
          </CardTitle>
          <CardDescription>
            Submit site expenses from Telegram without signing in each time. Ask your
            admin to configure TELEGRAM_BOT_TOKEN on the server.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const botLink = botUsername ? `https://t.me/${botUsername}` : null

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Telegram expenses
          </CardTitle>
          {isLinked ? (
            <Badge className="bg-success/15 text-success border-success/30">Connected</Badge>
          ) : (
            <Badge variant="outline">Not connected</Badge>
          )}
        </div>
        <CardDescription>
          Link once, then log expenses from Telegram. They appear in the app as pending
          for PM approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="list-decimal space-y-1 pl-4 text-sm text-muted-foreground">
          <li>
            Open{" "}
            {botLink ? (
              <a
                href={botLink}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                @{botUsername}
              </a>
            ) : (
              "your bot"
            )}{" "}
            in Telegram
          </li>
          <li>Generate a code below and send: /link CODE</li>
          <li>Use /expense or quick format: 2500 Materials Cement 50 bags</li>
        </ol>

        {code ? (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Your link code
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-mono text-2xl font-bold tracking-widest">{code}</span>
              <Button type="button" variant="outline" size="sm" onClick={copyCode}>
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                Copy
              </Button>
            </div>
            {expiresAt ? (
              <p className="mt-2 text-xs text-muted-foreground">
                Expires {new Date(expiresAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        ) : null}

        <Button type="button" onClick={generateCode} disabled={isPending}>
          {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isLinked ? "Generate new link code" : "Connect Telegram"}
        </Button>
      </CardContent>
    </Card>
  )
}
