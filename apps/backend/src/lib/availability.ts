/**
 * The rules that decide whether a vehicle is free.
 *
 * Kept out of the workflow steps so the reservation path and the quote path
 * answer the question identically — a vehicle shown as available on the
 * results page must still be available when the customer pays, and the only
 * way to guarantee that is one definition of "taken".
 *
 * ⚠️ Both numbers below are business assumptions with sensible defaults, not
 * facts supplied by the owner. `BOOKING_SLOT_MINUTES` is how long one transfer
 * ties a car up, door to door including the return leg; 120 is a conservative
 * guess for Doha. Confirm it, then set the variable rather than editing here.
 */

/** How long a vehicle is considered busy either side of a pickup. */
export const SLOT_MINUTES = Number(process.env.BOOKING_SLOT_MINUTES ?? 120)

/** How many of a vehicle exist, when the product does not say. */
export const DEFAULT_UNITS = 1

export function slotWindowMs(): number {
  return SLOT_MINUTES * 60_000
}

/** The span of pickup times whose vehicles collide with this one. */
export function overlapRange(pickupAt: Date): { from: Date; to: Date } {
  const w = slotWindowMs()
  return { from: new Date(pickupAt.getTime() - w), to: new Date(pickupAt.getTime() + w) }
}

/**
 * How many of this vehicle the owner runs. Set `units` on the product's
 * metadata in the admin — two Toyota Rushes means `units: 2` and the site
 * sells two at the same hour, not one and not unlimited.
 */
export function readUnits(metadata: Record<string, unknown> | null): number {
  const raw = metadata?.["units"]
  const value = typeof raw === "string" ? Number(raw) : raw
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.floor(value) : DEFAULT_UNITS
}

type SlotLike = { order_id: string | null; expires_at: Date | string | null; cart_id?: string | null }

/**
 * Whether a stored row still occupies a car.
 *
 * A committed booking always does. An uncommitted hold does only until it
 * lapses, so an abandoned checkout frees the vehicle immediately rather than
 * waiting for the purge job. A hold belonging to `ignoreCartId` is skipped so
 * a customer never competes with their own reservation.
 */
export function countsAgainstCapacity(slot: SlotLike, ignoreCartId?: string): boolean {
  if (ignoreCartId && slot.cart_id === ignoreCartId && !slot.order_id) {
    return false
  }
  if (slot.order_id) {
    return true
  }
  if (!slot.expires_at) {
    return true
  }
  const expires = slot.expires_at instanceof Date ? slot.expires_at : new Date(slot.expires_at)
  return expires.getTime() > Date.now()
}
