import { createHash } from 'crypto'

/** @type {import('next').NextConfig} */

function ensureProductionServerActionsKey() {
  if (process.env.NODE_ENV !== 'production') return

  const configured = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim()
  if (configured) return

  const seed =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'vraconstruction.app'

  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = createHash('sha256')
    .update(`vra-server-actions:${seed}`)
    .digest('base64')

  console.warn(
    '[next.config] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is not set. Using a stable derived key for this project. For best security, set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY in hPanel (build + runtime).',
  )
}

ensureProductionServerActionsKey()

const nextConfig = {
  deploymentId:
    process.env.NEXT_DEPLOYMENT_ID ??
    process.env.HOSTINGER_DEPLOYMENT_ID ??
    undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
