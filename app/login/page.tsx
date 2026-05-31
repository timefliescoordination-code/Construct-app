import { LoginForm } from "@/components/auth/login-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login | VRA HOMES",
  description: "Sign in to your VRA HOMES account",
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        <LoginForm />
      </div>
    </main>
  )
}
