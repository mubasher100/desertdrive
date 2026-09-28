import { testProof } from "./test-proof"
import { fareUnits, meetsLeadTime } from "./fare-units"

/** The only payment provider a customer may complete a booking with. */
export const CARD_PROVIDER = "pp_skipcash_skipcash"

export type CompletionFacts = {
  /** Provider of every payment session on the cart. */
  providers: Array<string | undefined>
  /** Whether any line is the 1 QAR test vehicle. */
  holdsTestVehicle: boolean
  /** `cart.metadata.test_proof`, as found. */
  proof: unknown
  /** TEST_BOOKING_KEY, as configured. Unset means test bookings are impossible. */
  key: string | undefined
  /**
   * The trip, when the cart holds a vehicle. Absent means no vehicle line —
   * nothing to check the fare of.
   */
  trip?: {
    pickupAt: unknown
    returnAt: unknown
    /** Quantity on the vehicle line: the fare units the customer is paying for. */
    quantity: number
    /** When the cart was created — server-set, so the one clock a client cannot move. */
    createdAt: Date
  }
}

/**
 * How far before the cart's creation it is treated as priced.
 *
 * The storefront quotes a moment BEFORE it creates the cart, so a quote taken
 * at 12h00m01s of notice (one fare) can sit on a cart created at 11h59m59s
 * (two). Without slack that cart is refused at completion — which, on the
 * card path, is AFTER SkipCash has charged it. Ten minutes of leniency costs a
 * few minutes of short-notice revenue at worst; refusing a paid booking costs
 * a customer.
 */
const GRACE_MS = 10 * 60_000

/**
 * Carts created before this are not checked for the short-notice fare.
 *
 * ⚠️ The deploy race (CLAUDE.md). The storefront publishes in ~2 minutes and
 * the backend in 10–20, so for a while the NEW storefront asks the OLD backend
 * for a quote, gets no fare units, and books a short-notice trip at one fare.
 * Checked after the new backend lands, that cart would be refused at
 * completion — which on the card path is after SkipCash has charged it.
 * Carts from before this instant, comfortably after both deploys, are left
 * alone. It is inert from then on and can be deleted in a later change.
 */
export const SHORT_NOTICE_ENFORCED_FROM = new Date("2026-09-28T22:00:00Z")

/**
 * Why a cart may not become an order, or null if it may. Pure, so the gate
 * can be tested without standing up a cart, a payment and a region.
 */
export type CompletionProblem = "not-card" | "test-without-key" | "no-trip" | "too-soon" | "under-priced"

export function completionProblem(f: CompletionFacts): CompletionProblem | null {
  if (f.providers.some((p) => p !== CARD_PROVIDER)) return "not-card"
  if (f.holdsTestVehicle && (!f.key || typeof f.proof !== "string" || f.proof !== testProof(f.key))) {
    return "test-without-key"
  }

  if (f.trip) {
    const { pickupAt, returnAt, quantity, createdAt } = f.trip
    // An order with no pickup time is not a booking a driver can do.
    if (typeof pickupAt !== "string" || Number.isNaN(new Date(pickupAt).getTime())) return "no-trip"

    const pricedAt = new Date(createdAt.getTime() - GRACE_MS)

    /**
     * The 6-hour minimum, enforced here as well as in the storefront — which
     * was the ONLY place it lived, so the raw Store API would take a booking
     * for twenty minutes from now.
     */
    if (!meetsLeadTime(pickupAt, pricedAt)) return "too-soon"

    /**
     * The short-notice fare. The vehicle line must carry at least as many
     * fare units as the trip's notice requires; fewer means a short-notice
     * trip at the ordinary price. More is left alone — that is only ever a
     * customer overpaying, which the quote never produces.
     */
    const expected = fareUnits(pickupAt, typeof returnAt === "string" ? returnAt : null, pricedAt).units
    if (quantity < expected && createdAt >= SHORT_NOTICE_ENFORCED_FROM) return "under-priced"
  }

  return null
}
