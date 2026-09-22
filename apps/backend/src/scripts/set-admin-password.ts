import { ExecArgs } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Sets an existing admin user's password.
 *
 * Medusa's own "forgot password" route emails a signed reset token, which is
 * useless until a mail provider is configured — and it is exactly then that
 * you are most likely to be locked out. This script goes straight at the
 * emailpass provider instead.
 *
 *   npx medusa exec ./src/scripts/set-admin-password.ts <email> <password>
 *
 * Against production, run it with the production DATABASE_URL and
 * ALLOW_INMEMORY_INFRA=true (the script needs no Redis; the flag only skips
 * the guard that stops a Redis-less *deploy*).
 */
export default async function setAdminPassword({ container, args }: ExecArgs) {
  const logger = container.resolve("logger")
  const [email, password] = args

  if (!email || !password) {
    logger.error("Usage: medusa exec ./src/scripts/set-admin-password.ts <email> <password>")
    return
  }
  if (password.length < 8) {
    logger.error("Refusing to set a password shorter than 8 characters.")
    return
  }

  const auth = container.resolve(Modules.AUTH)

  const [identity] = await auth.listAuthIdentities({
    provider_identities: { entity_id: email, provider: "emailpass" },
  })

  if (!identity) {
    logger.error(`No emailpass identity for "${email}". Create the user first with: npx medusa user -e ${email} -p <password>`)
    return
  }

  const result = await auth.updateProvider("emailpass", { entity_id: email, password })

  if (!result.success) {
    logger.error(`Could not update the password: ${result.error}`)
    return
  }

  logger.info(`Password updated for ${email}.`)
}
