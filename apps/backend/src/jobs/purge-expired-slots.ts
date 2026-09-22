import type { MedusaContainer } from "@medusajs/framework/types"
import { BOOKING_SLOT_MODULE } from "../modules/booking-slot"
import type BookingSlotModuleService from "../modules/booking-slot/service"

/**
 * Removes vehicle holds from checkouts that were never finished.
 *
 * Capacity already ignores a lapsed hold, so this is housekeeping rather than
 * correctness — it stops the table growing without bound from abandoned
 * checkouts.
 */
export default async function purgeExpiredSlots(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const slots = container.resolve(BOOKING_SLOT_MODULE) as BookingSlotModuleService

  const stale = await slots.listBookingSlots({
    order_id: null,
    expires_at: { $lt: new Date() },
  })

  if (!stale.length) {
    return
  }

  await slots.deleteBookingSlots(stale.map((s) => s.id))
  logger.info(`booking-slot: purged ${stale.length} expired hold(s)`)
}

export const config = {
  name: "purge-expired-booking-slots",
  // Every fifteen minutes: holds last thirty, so nothing lingers for long.
  schedule: "*/15 * * * *",
}
