const checkEnvVariables = require("./check-env-variables")

checkEnvVariables()

/**
 * Desert Drive runs on Cloudflare Workers via @opennextjs/cloudflare, on
 * Next 16 since 1 Nov 2026 — OpenNext refuses a Next major once its two years
 * of security support end, which for 15 was 21 Oct 2026. On 16
 * `bypassTagCacheOnCacheHit` must stay false: see open-next.config.ts.
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
   * Inherited from the Medusa starter, and a trap: a green `next build` proves
   * nothing about types. `npm run typecheck` (tsc --noEmit) and `npm run lint`
   * are what actually gate correctness, and CI runs them separately for that
   * reason. (Next 16 no longer lints during the build at all.)
   */
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    /**
     * No optimizer: on Cloudflare Workers, Next's image resizing needs an
     * IMAGES binding (Cloudflare Images) that this Worker does not have, so
     * every `/_next/image` request logged "env.IMAGES binding is not defined"
     * and sent the original file anyway — a Worker invocation and a log line
     * per image, for nothing. Images are served as the static files they
     * already are, each prepared at the size it is used (the fleet's squares
     * and 3:2 crops; the hero's 960/1920 pair via <picture>).
     */
    unoptimized: true,
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
