import { model } from "@medusajs/framework/utils"

/**
 * The site's VAPID key pair: what the push services use to know that a
 * message really comes from this backend.
 *
 * Generated on first use and kept here, so turning push on needs no Railway
 * variable. VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY, when set, win. Changing the
 * pair invalidates every device's subscription — never rotate it casually.
 * No route ever returns the private key.
 */
const PushKey = model.define("push_key", {
  id: model.id().primaryKey(),
  public_key: model.text(),
  private_key: model.text(),
})

export default PushKey
