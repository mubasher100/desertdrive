import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import type { ICartModuleService, ILockingModule, RemoteQueryFunction } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BOOKING_SLOT_MODULE } from "../../../modules/booking-slot"
import type BookingSlotModuleService from "../../../modules/booking-slot/service"
import { slotWindowMs, overlapRange, countsAgainstCapacity, readUnits } from "../../../lib/availability"

type IQueryModule = Omit<RemoteQueryFunction, symbol>

/** Thirty minutes is long enough to finish a 3-D Secure challenge and short enough not to strand a car. */
const HOLD_MINUTES = Number(process.env.BOOKING_HOLD_MINUTES ?? 30)

export type ReserveSlotInput = { cart_id: string }
export type ReserveSlotResult = { slot_ids: string[]; product_id: string; pickup_ats: string[] }

/**
 * Takes the last free car off the shelf for this cart, or refuses.
 *
 * Runs under the locking module, keyed per vehicle, because the check and the
 * write must not interleave: two customers paying in the same second would
 * otherwise both read "one left" and both book it. Redis backs the lock in
 * production, so this holds across instances, not just within one process.
 *
 * Compensation deletes the row, so a failure later in the checkout (payment
 * declined, cart refuses to complete) puts the car back rather than stranding
 * it until the hold lapses.
 */
export const reserveSlotStep = createStep(
  "reserve-booking-slot",
  async (input: ReserveSlotInput, { container }) => {
    const cartService = container.resolve(Modules.CART) as ICartModuleService
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as IQueryModule
    const locking = container.resolve(Modules.LOCKING) as ILockingModule
    const slots = container.resolve(BOOKING_SLOT_MODULE) as BookingSlotModuleService

    const cart = await cartService.retrieveCart(input.cart_id, {
      relations: ["items"],
    })

    const meta = cart.metadata ?? {}
    const pickupRaw = meta["pickup_at"]
    const returnRaw = meta["return_at"]
    const pickupAt = typeof pickupRaw === "string" ? new Date(pickupRaw) : null

    if (!pickupAt || Number.isNaN(pickupAt.getTime())) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "This cart has no pickup time, so no vehicle can be held for it."
      )
    }

    // A return needs the same car twice. Both legs are held together or
    // neither is — holding only the outbound would sell a return we cannot
    // drive back.
    const returnAt = typeof returnRaw === "string" ? new Date(returnRaw) : null
    const instants = [pickupAt, ...(returnAt && !Number.isNaN(returnAt.getTime()) ? [returnAt] : [])]

    const variantId = cart.items?.[0]?.variant_id
    if (!variantId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "This cart has no vehicle.")
    }

    const { data: variants } = await query.graph({
      entity: "variant",
      fields: ["id", "product.id", "product.handle", "product.title", "product.metadata"],
      filters: { id: variantId },
    })

    const product = variants?.[0]?.product
    if (!product?.id) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Vehicle not found for this cart.")
    }

    const units = readUnits(product.metadata as Record<string, unknown> | null)

    // One lock per vehicle, covering both legs. Different cars are
    // independent, so two people booking different vehicles for the same
    // minute never wait on each other — and because a return locks the same
    // key once, two returns can never deadlock against each other.
    const created = await locking.execute(
      `booking-slot:${product.id}`,
      async () => {
        const mine = await slots.listBookingSlots({ product_id: product.id, cart_id: input.cart_id })
        const held = mine.filter((s) => !s.order_id)

        // This cart already holds its legs (the customer went back and paid
        // again). Extend rather than double-book against itself.
        if (held.length === instants.length) {
          await slots.updateBookingSlots(
            held.map((s) => ({ id: s.id, expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000) }))
          )
          return { slots: held, reused: true }
        }

        for (const at of instants) {
          const { from, to } = overlapRange(at)
          const existing = await slots.listBookingSlots({
            product_id: product.id,
            pickup_at: { $gte: from, $lte: to },
          })
          const taken = existing.filter((s) =>
            countsAgainstCapacity(
              { order_id: s.order_id, expires_at: s.expires_at, cart_id: s.cart_id },
              input.cart_id
            )
          )
          if (taken.length >= units) {
            throw new MedusaError(
              MedusaError.Types.NOT_ALLOWED,
              `Every ${product.title} is already booked around this time.`
            )
          }
        }

        const expires = new Date(Date.now() + HOLD_MINUTES * 60_000)
        const rows = await slots.createBookingSlots(
          instants.map((at) => ({
            product_id: product.id,
            vehicle_handle: product.handle ?? "",
            pickup_at: at,
            cart_id: input.cart_id,
            order_id: null,
            expires_at: expires,
          }))
        )

        return { slots: Array.isArray(rows) ? rows : [rows], reused: false }
      },
      // Wait rather than fail if another checkout holds the lock for an instant.
      { timeout: 5 }
    )

    /**
     * Stamp the hold onto the cart. Medusa copies cart metadata onto the order
     * at completion, so this is how the order.placed subscriber finds the hold
     * to commit — an order has no cart_id column, and the cart↔order link is
     * not worth traversing for one string.
     */
    const slotIds = created.slots.map((s) => s.id)

    await cartService.updateCarts(input.cart_id, {
      metadata: { ...meta, booking_slot_id: slotIds[0], booking_slot_ids: slotIds.join(",") },
    })

    return new StepResponse<ReserveSlotResult, { slot_ids: string[]; reused: boolean }>(
      {
        slot_ids: slotIds,
        product_id: product.id,
        pickup_ats: instants.map((d) => d.toISOString()),
      },
      { slot_ids: slotIds, reused: created.reused }
    )
  },
  async (compensate, { container }) => {
    // Only remove a row this step created. A reused hold predates us.
    if (!compensate || compensate.reused) {
      return
    }
    const slots = container.resolve(BOOKING_SLOT_MODULE) as BookingSlotModuleService
    await slots.deleteBookingSlots(compensate.slot_ids)
  }
)

export { slotWindowMs, HOLD_MINUTES }
