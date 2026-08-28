/**
 * Resolves the Medusa backend origin.
 *
 * The Medusa starter renamed this variable from NEXT_PUBLIC_MEDUSA_BACKEND_URL to
 * MEDUSA_BACKEND_URL, because every Store API call goes through a server component
 * or a server action — there is no reason to bake the backend origin into the
 * client bundle. Desert Drive follows that.
 *
 * The NEXT_PUBLIC_ name is still honoured as a fallback so that an environment
 * configured against the older name does not silently fall back to localhost and
 * fail with ECONNREFUSED at build time. Prefer MEDUSA_BACKEND_URL.
 */
export const MEDUSA_BACKEND_URL =
  process.env.MEDUSA_BACKEND_URL ||
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  "http://localhost:9000"
