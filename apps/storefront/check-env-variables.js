const c = require("ansi-colors")

/**
 * next.config.js loads this, and next.config.js is loaded by `next lint` as well
 * as by `dev` and `build`. Without an escape hatch, linting in CI — where no
 * storefront secrets exist — would fail on a missing publishable key rather than
 * on anything to do with lint.
 *
 * SKIP_ENV_VALIDATION is set by the `lint` script and by CI. Nothing else should
 * set it; a build that skips this check produces a storefront whose every Store
 * API request is rejected for a missing key.
 */
const requiredEnvs = [
  {
    key: "NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY",
    description:
      "Medusa Admin → Settings → API Key Management → Publishable API Keys.\n" +
      "    Must be linked to a sales channel. Store API requests are rejected without it.\n" +
      "    https://docs.medusajs.com/resources/storefront-development/publishable-api-keys",
  },
]

function checkEnvVariables() {
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    return
  }

  const missingEnvs = requiredEnvs.filter(function (env) {
    return !process.env[env.key]
  })

  if (missingEnvs.length > 0) {
    console.error(
      c.red.bold("\n🚫 Error: Missing required environment variables\n")
    )

    missingEnvs.forEach(function (env) {
      console.error(c.yellow(`  ${c.bold(env.key)}`))
      if (env.description) {
        console.error(c.dim(`    ${env.description}\n`))
      }
    })

    console.error(
      c.yellow(
        "\nSet these in apps/storefront/.env.local (see .env.template), or in the\n" +
          "Cloudflare Worker's variables in production.\n"
      )
    )

    process.exit(1)
  }
}

module.exports = checkEnvVariables
