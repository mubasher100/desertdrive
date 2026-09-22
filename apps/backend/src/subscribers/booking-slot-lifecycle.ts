import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import type { IOrderModuleService } from "@medusajs/framework/types"
import { BOOKING_SLOT_MODULE } from "../modules/booking-slot"
import type BookingSlotModuleService from "../modules/booking-slot/service"

/**
 * Keeps the vehicle holds in step with the orders they belong to.
 *
 * On placement the hold stops being a hold: it gets the order id and loses its
 * expiry, so the purge job leaves it alone and the car stays booked. On
 * cancellation the row goes, which is what puts the car back on sale — the
 * owner cancelling in the admin is the only way a committed slot is released.
 */
export default async function bookingSlotLifecycle({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")
  const slots = container.resolve(BOOKING_SLOT_MODULE) as BookingSlotModuleService
  const orderService = container.resolve(Modules.ORDER) as IOrderModuleService
  const orderId = event.data.id

  if (event.name === "order.canceled") {
    const held = await slots.listBookingSlots({ order_id: orderId })
    if (held.length) {
      await slots.deleteBookingSlots(held.map((s) => s.id))
      logger.info(`booking-slot: released ${held.length} slot(s) for cancelled order ${orderId}`)
    }
    return
  }

  const order = await orderService.retrieveOrder(orderId, { select: ["id", "metadata"] })
  const slotId = (order.metadata ?? {})["booking_slot_id"]

  if (typeof slotId !== "string") {
    // A booking with no hold means the reservation step was skipped — worth
    // knowing about, because it is the state that allows a double booking.
    logger.warn(`booking-slot: order ${orderId} carries no hold; it was not reserved through checkout`)
    return
  }

  const [held] = await slots.listBookingSlots({ id: slotId })

  if (!held) {
    logger.warn(`booking-slot: hold ${slotId} for order ${orderId} no longer exists`)
    return
  }

  // Committed: it stops being a hold and the purge job leaves it alone.
  await slots.updateBookingSlots({ id: held.id, order_id: orderId, expires_at: null })
  logger.info(`booking-slot: committed ${held.vehicle_handle} at ${held.pickup_at.toISOString()} to order ${orderId}`)
}

export const config: SubscriberConfig = {
  event: ["order.placed", "order.canceled"],
}
