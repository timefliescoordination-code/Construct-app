/** @type {import('next').NextConfig} */

function assertProductionServerActionsKey() {
  if (process.env.NODE_ENV !== 'production') return

  const key = process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY?.trim()
  if (!key) {
    throw new Error(
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY is required for production builds. Generate with: openssl rand -base64 32. Set it in Hostinger hPanel environment variables before deploy (must be present at build time and runtime).',
    )
  }
}

assertProductionServerActionsKey()

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
