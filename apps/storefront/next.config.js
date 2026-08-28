const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Desert Drive runs on Cloudflare Workers via @opennextjs/cloudflare, and is
 * deliberately held on Next 15. Do not upgrade to Next 16 without reading the
 * `bypassTagCacheOnCacheHit` note in the root CLAUDE.md first — on 16,
 * revalidateTag becomes stale-while-revalidate by default and that flag stops
 * being safe.
 */

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  /**
   * Both of these are inherited from the Medusa starter and both are traps:
   * a green `next build` proves nothing about types or lint. `npm run typecheck`
   * (tsc --noEmit) and `npm run lint` are what actually gate correctness, and CI
   * runs them separately for that reason.
   */
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      // Local Medusa backend during development.
      { protocol: "http", hostname: "localhost" },
      // Railway-hosted backend, for product and vehicle imagery served by Medusa.
      { protocol: "https", hostname: "*.up.railway.app" },
      // Cloudflare R2 public bucket, once vehicle photography moves there.
      { protocol: "https", hostname: "*.r2.dev" },
    ],
  },
}

module.exports = nextConfig
