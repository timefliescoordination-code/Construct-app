import { createHash } from 'crypto'

/** @type {import('next').NextConfig} */

function ensureProductionServerActionsKey() {
  if (process.env.NODE_ENV !== 'production') return

  const configured = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim()
  if (configured) return

  // Fixed project seed so build-time and runtime always agree (Hostinger env can differ).
  process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY = createHash('sha256')
    .update('vra-server-actions:vraconstruction.app')
    .digest('base64')

  console.warn(
    '[next.config] NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is not set. Using a stable derived key for this project. For best security, set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY in hPanel (build + runtime).',
  )
}

ensureProductionServerActionsKey()

const noStoreHeaders = [
  {
    key: 'Cache-Control',
    value: 'private, no-cache, no-store, max-age=0, must-revalidate',
  },
  { key: 'CDN-Cache-Control', value: 'no-store' },
  { key: 'X-Accel-Buffering', value: 'no' },
]

const nextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  // Do not set deploymentId from HOSTINGER_DEPLOYMENT_ID. That value is often
  // present only at runtime (or changes on restart), so Next.js looks for a
  // deployment that was never built and App Router pages/API 500 while
  // middleware redirects still work.
  generateEtags: false,
  // LiteSpeed / hCDN already gzip; Next compressing too can abort proxied HTML/JSON.
  compress: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      { source: '/login', headers: noStoreHeaders },
      { source: '/signup', headers: noStoreHeaders },
      { source: '/setup', headers: noStoreHeaders },
      { source: '/auth/:path*', headers: noStoreHeaders },
      { source: '/api/:path*', headers: noStoreHeaders },
    ]
  },
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/images/vra-logo.png' }]
  },
}

export default nextConfig
