import Link from "next/link"
import { AlertCircle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getSupabaseAnonKeyStatus,
  getSupabaseUrlStatus,
  isSupabaseConfigured,
} from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

function StatusRow({ label, status }: { label: string; status: string }) {
  const ok = status === "set"
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={ok ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
        {status === "set"
          ? "Detected"
          : status === "placeholder"
            ? "Placeholder value"
            : status === "invalid"
              ? "Invalid format"
              : "Not set"}
      </span>
    </div>
  )
}

export default function SetupPage() {
  const urlStatus = getSupabaseUrlStatus()
  const keyStatus = getSupabaseAnonKeyStatus()
  const configured = isSupabaseConfigured()

  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg border-border">
        <CardHeader>
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm font-medium">Setup required</span>
          </div>
          <CardTitle>Connect Supabase</CardTitle>
          <CardDescription>
            {configured
              ? "Environment variables are set. If you still see this page, redeploy Vercel or hard-refresh the browser."
              : "Add Supabase keys in Vercel, then redeploy. .env.local only affects your computer, not the live site."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">Live deployment check</p>
            <StatusRow label="Supabase URL" status={urlStatus} />
            <StatusRow label="Supabase anon / publishable key" status={keyStatus} />
            {urlStatus === "invalid" && (
              <p className="text-xs text-amber-600">
                URL must look like{" "}
                <code className="rounded bg-muted px-1">https://abcdefgh.supabase.co</code> — no
                trailing slash, no <code className="rounded bg-muted px-1">/auth/v1</code>, no
                quotes.
              </p>
            )}
          </div>

          <p className="text-xs font-medium text-foreground">Vercel (required for production)</p>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              Vercel → your project → <strong>Settings</strong> →{" "}
              <strong>Environment Variables</strong>
            </li>
            <li>
              Add exactly (copy names — no typos):
              <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">
                NEXT_PUBLIC_SUPABASE_URL
                <br />
                NEXT_PUBLIC_SUPABASE_ANON_KEY
                <br />
                <span className="text-muted-foreground">
                  (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY from Vercel integration)
                </span>
                <br />
                SUPABASE_SERVICE_ROLE_KEY
              </div>
            </li>
            <li>
              Values from Supabase → <strong>Project Settings → API</strong> (Project URL + anon
              public key + service_role secret).
            </li>
            <li>
              Enable for <strong>Production</strong>, <strong>Preview</strong>, and{" "}
              <strong>Development</strong>.
            </li>
            <li>
              <strong>Deployments</strong> → latest → <strong>⋯</strong> →{" "}
              <strong>Redeploy</strong> (required — editing env vars alone is not enough).
            </li>
          </ol>

          <p className="text-xs font-medium text-foreground">Supabase database</p>
          <ol className="list-decimal list-inside space-y-2" start={1}>
            <li>
              Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                supabase/schema-continue.sql
              </code>{" "}
              if <code className="rounded bg-muted px-1">schema.sql</code> failed on profiles.
            </li>
            <li>
              Authentication → URL Configuration → add your{" "}
              <code className="rounded bg-muted px-1">*.vercel.app</code> URL to Redirect URLs.
            </li>
          </ol>

          <Button asChild className="w-full">
            <a
              href="https://supabase.com/dashboard/project/_/settings/api"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Supabase API settings
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>

          {configured ? (
            <Button asChild className="w-full" variant="default">
              <Link href="/login">Go to login</Link>
            </Button>
          ) : (
            <p className="text-center text-xs">
              After redeploying Vercel, refresh this page.{" "}
              <Link href="/login" className="text-primary hover:underline">
                Try login
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  )
}
