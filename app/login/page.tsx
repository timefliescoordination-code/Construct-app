import { LoginForm } from "@/components/auth/login-form"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Login | VRA HOMES",
  description: "Sign in to your VRA HOMES account",
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background p-4">
      <LoginForm />
    </main>
  )
}
