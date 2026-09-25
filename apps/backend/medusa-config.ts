import { loadEnv, defineConfig } from "@medusajs/framework/utils"

loadEnv(process.env.NODE_ENV || "development", process.cwd())

const IS_PRODUCTION = process.env.NODE_ENV === "production"

/**
 * `medusa start` forces NODE_ENV=production even on a dev machine, so running a
 * production build locally would otherwise trip the Redis guard below. This escape
 * hatch exists for exactly that case.
 *
 * NEVER set ALLOW_INMEMORY_INFRA on Railway — it disables the guard that stops a
 * Redis-less deploy, and a Redis-less deploy silently loses scheduled jobs,
 * subscribers and any workflow that outlives a restart.
 */
const ALLOW_INMEMORY_INFRA = process.env.ALLOW_INMEMORY_INFRA === "true"

const DATABASE_URL = process.env.DATABASE_URL
const REDIS_URL = process.env.REDIS_URL

// ---------------------------------------------------------------------------
// Fail fast, with the actual fix in the message.
//
// Every check here corresponds to a failure mode that does NOT surface at boot:
// it surfaces hours later as intermittent query errors, a rejected TLS handshake
// under load, or jobs that quietly stop firing. Crashing at startup with an
// explanation is strictly better.
// ---------------------------------------------------------------------------

/**
 * Whether the database is on this machine. Drives the TLS decision below: a
 * local Postgres container does not speak SSL, a managed one requires it.
 */
const IS_LOCAL_DATABASE = /@(localhost|127\.0\.0\.1|\[::1\]|host\.docker\.internal)[:/]/.test(
  DATABASE_URL ?? ""
)

if (!DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.template to .env and fill in the Supabase " +
      "SESSION POOLER connection string (port 5432)."
  )
}

if (DATABASE_URL.includes(":6543")) {
  throw new Error(
    "DATABASE_URL points at Supabase's TRANSACTION pooler (port 6543). Medusa's ORM " +
      "needs prepared statements to survive between queries, and the transaction pooler " +
      "swaps connections underneath them — migrations fail and you get intermittent " +
      '`prepared statement "s1" does not exist` under load.\n' +
      "Use the SESSION pooler on port 5432 instead."
  )
}

if (/[?&]ssl_?mode=/i.test(DATABASE_URL)) {
  throw new Error(
    "Remove the sslmode parameter from DATABASE_URL. node-postgres reads it as " +
      "`verify-full` and rejects Supabase's certificate chain with " +
      "SELF_SIGNED_CERT_IN_CHAIN. TLS is configured via databaseDriverOptions below."
  )
}

if (IS_PRODUCTION) {
  const weak = (["JWT_SECRET", "COOKIE_SECRET"] as const).filter(
    (k) => !process.env[k] || process.env[k] === "supersecret"
  )
  if (weak.length) {
    throw new Error(
      `${weak.join(" and ")} still ${weak.length > 1 ? "hold" : "holds"} the Medusa ` +
        "starter's default value in production. Anyone can forge a session with a " +
        "known secret. Generate real ones with: openssl rand -base64 32"
    )
  }
}

if (IS_PRODUCTION && !REDIS_URL && !ALLOW_INMEMORY_INFRA) {
  throw new Error(
    "REDIS_URL is not set in production. Medusa would silently fall back to in-memory " +
      "cache, event bus, workflow engine and locking — which breaks scheduled jobs, " +
      "subscribers and long-running workflows across restarts.\n" +
      "Set REDIS_URL to the Railway Redis PRIVATE url. (ALLOW_INMEMORY_INFRA=true " +
      "bypasses this for running a production build locally — never set it on Railway.)"
  )
}

/**
 * Redis has to be wired into all four concerns — caching, events, workflows and
 * locking. Miss one and that one concern silently degrades to in-memory while the
 * other three look healthy, which is a genuinely miserable thing to debug.
 *
 * Note the option shapes differ between them on purpose: the workflow engine nests
 * everything under `redis`, the others take `redisUrl` at the top level.
 *
 * When REDIS_URL is unset (local dev) we register nothing and let Medusa use its
 * in-memory defaults. The guard above is what stops that reaching production.
 */
const redisModules = REDIS_URL
  ? [
      {
        // The old `@medusajs/medusa/cache-redis` module is deprecated as of v2.11
        // and will be removed. This is the provider-based replacement.
        resolve: "@medusajs/medusa/caching",
        options: {
          providers: [
            {
              resolve: "@medusajs/caching-redis",
              id: "caching-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
      {
        resolve: "@medusajs/medusa/event-bus-redis",
        options: {
          redisUrl: REDIS_URL,
          jobOptions: {
            removeOnComplete: { age: 3600, count: 1000 },
            removeOnFail: { age: 24 * 3600, count: 1000 },
          },
        },
      },
      {
        resolve: "@medusajs/medusa/workflow-engine-redis",
        options: {
          redis: { redisUrl: REDIS_URL },
        },
      },
      {
        resolve: "@medusajs/medusa/locking",
        options: {
          providers: [
            {
              resolve: "@medusajs/medusa/locking-redis",
              id: "locking-redis",
              is_default: true,
              options: { redisUrl: REDIS_URL },
            },
          ],
        },
      },
    ]
  : []

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: DATABASE_URL,
    databaseDriverOptions: {
      connection: {
        /**
         * Supabase terminates TLS with a chain node-postgres will not verify on
         * its own. Encryption stays on; only chain verification is relaxed. This
         * is the supported way to do it — do not "fix" it by putting sslmode in
         * the URL, which node-postgres reads as verify-full and which then fails
         * with SELF_SIGNED_CERT_IN_CHAIN.
         *
         * Off for a local database, because a plain Postgres container does not
         * speak SSL at all and refuses the connection outright with
         * "The server does not support SSL connections". Deriving this from the
         * host means local dev and Supabase both work with no extra variable to
         * set — and no chance of someone disabling TLS globally to fix local dev.
         */
        ssl: IS_LOCAL_DATABASE ? false : { rejectUnauthorized: false },
      },
    },
    redisUrl: REDIS_URL,
    /**
     * `shared` runs the API and the background worker in one process, which is
     * right until traffic justifies paying for two. Splitting later means running
     * a second Railway service with MEDUSA_WORKER_MODE=worker and flipping this
     * one to `server` — no code change.
     */
    workerMode:
      (process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server") || "shared",
    http: {
      // Three separate lists. Adding a storefront origin almost always means
      // updating STORE_CORS *and* AUTH_CORS, not just one of them.
      storeCors: process.env.STORE_CORS || "",
      adminCors: process.env.ADMIN_CORS || "",
      authCors: process.env.AUTH_CORS || "",
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
  },
  admin: {
    backendUrl: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
    // A dedicated worker service has no HTTP surface, so building the admin
    // bundle into it is wasted build minutes.
    disable: process.env.MEDUSA_WORKER_MODE === "worker",
  },
  modules: [
    // Desert Drive's own modules.
    { resolve: "./src/modules/fare-band" },
    { resolve: "./src/modules/booking-slot" },
    { resolve: "./src/modules/fare-zone" },
    { resolve: "./src/modules/place-index" },

    /**
     * Payment. The manual provider (pp_system_default) is always present and is
     * the cash-to-driver path. SkipCash is added only when its credentials are
     * set, so a dev machine without them still boots — the storefront shows
     * card as unavailable rather than the backend refusing to start.
     */
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: process.env.SKIPCASH_KEY_SECRET
          ? [
              {
                resolve: "./src/modules/skipcash",
                id: "skipcash",
                options: {
                  base_url: process.env.SKIPCASH_BASE_URL || "https://skipcashtest.azurewebsites.net",
                  client_id: process.env.SKIPCASH_CLIENT_ID,
                  key_id: process.env.SKIPCASH_KEY_ID,
                  key_secret: process.env.SKIPCASH_KEY_SECRET,
                  webhook_key: process.env.SKIPCASH_WEBHOOK_KEY,
                  backend_url: process.env.MEDUSA_BACKEND_URL || "http://localhost:9000",
                },
              },
            ]
          : [],
      },
    },

    /**
     * Email. Plain SMTP, so the business's existing Microsoft 365 mailbox works
     * today and any other provider works later by changing SMTP_* only.
     * Registered only when configured — without it, order.placed logs that no
     * confirmation was sent and the order is unaffected.
     */
    ...(process.env.SMTP_HOST
      ? [
          {
            resolve: "@medusajs/medusa/notification",
            options: {
              providers: [
                {
                  resolve: "./src/modules/smtp-notification",
                  id: "smtp",
                  options: {
                    channels: ["email"],
                    host: process.env.SMTP_HOST,
                    port: Number(process.env.SMTP_PORT || 587),
                    secure: process.env.SMTP_SECURE === "true",
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                    from: process.env.SMTP_FROM,
                    replyTo: process.env.SMTP_REPLY_TO,
                  },
                },
              ],
            },
          },
        ]
      : []),

    // Infrastructure. Empty in local dev, where Medusa's in-memory defaults apply.
    ...redisModules,
  ],
})
