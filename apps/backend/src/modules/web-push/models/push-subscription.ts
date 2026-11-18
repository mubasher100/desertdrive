import { model } from "@medusajs/framework/utils"

/**
 * One device that asked for push notifications: the owner's phone added to
 * the Home Screen, or a browser on a desk.
 *
 * `endpoint` is the push service's address for that device (Apple, Google or
 * Mozilla); `p256dh` and `auth` are the device's keys, which encrypt what is
 * sent. A subscription the push service reports gone (404/410) is deleted.
 */
const PushSubscription = model
  .define("push_subscription", {
    id: model.id().primaryKey(),
    endpoint: model.text().unique(),
    p256dh: model.text(),
    auth: model.text(),
    /** The admin user who turned it on, for the record. */
    user_id: model.text().nullable(),
    /** "iPhone", "Android", "Windows"… so the owner can tell devices apart. */
    device: model.text().nullable(),
  })

export default PushSubscription
