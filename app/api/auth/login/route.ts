import { type NextRequest } from 'next/server'
import { performPasswordLogin } from '@/lib/auth/password-login'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  return performPasswordLogin(request)
}
