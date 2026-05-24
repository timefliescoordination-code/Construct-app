import Link from "next/link"
import { AlertCircle, ExternalLink } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function SetupPage() {
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
            The app needs your new Supabase project credentials before it can run.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <ol className="list-decimal list-inside space-y-2">
            <li>Create a project at supabase.com (use a new account if needed).</li>
            <li>
              Run{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                supabase/schema.sql
              </code>{" "}
              in the SQL Editor.
            </li>
            <li>
              Open{" "}
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">
                .env.local
              </code>{" "}
              in this project and replace the placeholder values with your Project URL and anon key.
            </li>
            <li>
              Restart the dev server (
              <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">npm run dev</code>
              ).
            </li>
          </ol>

          <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">
            NEXT_PUBLIC_SUPABASE_URL=...
            <br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY=...
          </div>

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

          <p className="text-center text-xs">
            After updating <code className="rounded bg-muted px-1">.env.local</code>,{" "}
            <Link href="/login" className="text-primary hover:underline">
              go to login
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  )
}
