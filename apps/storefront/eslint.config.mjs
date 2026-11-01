import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

/**
 * Next 16 removed `next lint`; ESLint runs directly, with Next's own rules.
 */
export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // New with Next 16's config. It flags an effect that clears stale
      // results when the search query gets too short (location-picker), which
      // is correct as written; a warning keeps it visible without forcing a
      // rewrite of the field that holds the pre-hydration typing fix.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  globalIgnores([".next/**", ".open-next/**", ".wrangler/**", "node_modules/**", "cloudflare-env.d.ts"]),
])
