import { LoginForm } from "@/components/auth/login-form"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login | VRA HOMES",
  description: "Sign in to your VRA HOMES account",
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}
