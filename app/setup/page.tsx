import Link from "next/link"
import { AlertCircle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getBrowserSupabaseAnonKeyStatus,
  getBrowserSupabaseUrlStatus,
  getSupabaseEnvDiagnostics,
  isSupabaseConfiguredForBrowser,
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

function VarRow({ name, present }: { name: string; present: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
      <span className="text-muted-foreground truncate">{name}</span>
      <span className={present ? "text-emerald-600 shrink-0" : "text-amber-600 shrink-0"}>
        {present ? "found" : "missing"}
      </span>
    </div>
  )
}

export default function SetupPage() {
  const urlStatus = getBrowserSupabaseUrlStatus()
  const keyStatus = getBrowserSupabaseAnonKeyStatus()
  const configured = isSupabaseConfiguredForBrowser()
  const diagnostics = getSupabaseEnvDiagnostics()
  const hasServerOnlyVars =
    diagnostics.serverOnly.keyCandidates.some((v) => v.present) &&
    !diagnostics.browser.keyCandidates.some((v) => v.present)

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
              ? "Login and signup can use Supabase. Go to the login page."
              : hasServerOnlyVars
                ? "Integration added server-only keys (SUPABASE_ANON_KEY). Login needs NEXT_PUBLIC_* keys — add them below, then redeploy."
                : "Add NEXT_PUBLIC_* Supabase keys in Vercel, then redeploy. .env.local only affects your computer."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <div className="rounded-lg border border-border bg-muted/50 p-3 space-y-2">
            <p className="text-xs font-medium text-foreground">
              Browser check (required for login / signup)
            </p>
            <StatusRow label="NEXT_PUBLIC_SUPABASE_URL" status={urlStatus} />
            <StatusRow label="NEXT_PUBLIC anon or publishable key" status={keyStatus} />
            {urlStatus === "invalid" && (
              <p className="text-xs text-amber-600">
                URL must look like{" "}
                <code className="rounded bg-muted px-1">https://abcdefgh.supabase.co</code> — no
                trailing slash, no <code className="rounded bg-muted px-1">/auth/v1</code>, no
                quotes.
              </p>
            )}
            {!configured && (
              <div className="pt-2 space-y-2 border-t border-border">
                <div className="space-y-1">
                  <p className="text-[11px] font-medium text-foreground">NEXT_PUBLIC (browser)</p>
                  {diagnostics.browser.urlCandidates.map((v) => (
                    <VarRow key={v.name} name={v.name} present={v.present} />
                  ))}
                  {diagnostics.browser.keyCandidates.map((v) => (
                    <VarRow key={v.name} name={v.name} present={v.present} />
                  ))}
                </div>
                {(diagnostics.serverOnly.urlCandidates.some((v) => v.present) ||
                  diagnostics.serverOnly.keyCandidates.some((v) => v.present)) && (
                  <div className="space-y-1">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Server-only (not enough for login)
                    </p>
                    {diagnostics.serverOnly.urlCandidates.map((v) => (
                      <VarRow key={v.name} name={v.name} present={v.present} />
                    ))}
                    {diagnostics.serverOnly.keyCandidates.map((v) => (
                      <VarRow key={v.name} name={v.name} present={v.present} />
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-amber-600">
                  Copy values from Supabase API into <strong>NEXT_PUBLIC_*</strong> names, save, then{" "}
                  <strong>Redeploy</strong>.
                </p>
              </div>
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
