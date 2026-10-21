import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BOOKING_SLOT_MODULE } from "../../../modules/booking-slot"

type Slot = { id: string } & Record<string, unknown>
type SlotService = {
  listBookingSlots: (f: object) => Promise<Slot[]>
  deleteBookingSlots: (ids: string[]) => Promise<void>
  createBookingSlots: (data: object[]) => Promise<unknown>
}

/**
 * Puts a cancelled booking's car back on sale: deletes the slots holding it,
 * exactly as the order.canceled subscriber does for a Medusa-cancelled order.
 *
 * Compensates by recreating them, so if the order update after this fails,
 * the car is not left free for a booking the owner still believes stands.
 */
export const releaseBookingSlotsStep = createStep(
  "release-booking-slots",
  async (input: { order_id: string }, { container }) => {
    const slots = container.resolve(BOOKING_SLOT_MODULE) as SlotService
    const held = await slots.listBookingSlots({ order_id: input.order_id })
    if (held.length) await slots.deleteBookingSlots(held.map((s) => s.id))
    return new StepResponse({ released: held.length }, held)
  },
  async (held, { container }) => {
    if (!held?.length) return
    const slots = container.resolve(BOOKING_SLOT_MODULE) as SlotService
    await slots.createBookingSlots(
      held.map(({ id, created_at, updated_at, deleted_at, ...rest }) => ({ id, ...rest }))
    )
  }
)
