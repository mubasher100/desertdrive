/**
 * How many "fares" a trip costs, before anything else is added.
 *
 * A fare unit is one leg at the ordinary price. A one-way trip is 1, a return
 * is 2 — and a leg booked at SHORT NOTICE counts double. The unit count is the
 * vehicle line's quantity in the cart, exactly as legs always were, so the
 * variant price the owner edits in the admin stays the one price and the
 * multiplier never becomes a second price to keep in step.
 *
 * The owner's rules (27–28 Sept 2026):
 *   - under 6 hours' notice   → not bookable online at all (WhatsApp instead)
 *   - under 12 hours' notice  → 2× the fare
 *   - otherwise               → the fare
 *
 * Priced PER LEG, by that leg's own notice: a pickup tonight with the return
 * next week is 2 + 1 = 3 units, not 4. Surging a leg that is a week away
 * would be charging short-notice money for no short notice.
 *
 * ⚠️ There is a cliff at 12 hours — 11h59m costs twice 12h01m. That is the
 * owner's rule, chosen knowingly (28 Sept 2026). A taper would be gentler and
 * is a change to `unitsForLeg` only.
 */

const minutes = (name: string, fallback: number) => {
  const v = Number(process.env[name])
  return Number.isFinite(v) && v > 0 ? v : fallback
}

/** Below this much notice a pickup cannot be booked online. */
export const MIN_LEAD_MINUTES = () => minutes("MIN_LEAD_MINUTES", 360)
/** Below this much notice a leg is charged at the short-notice multiplier. */
export const SURGE_WINDOW_MINUTES = () => minutes("SURGE_WINDOW_MINUTES", 720)
/** How many fares a short-notice leg costs. Whole numbers only: it is a quantity. */
export const SURGE_MULTIPLIER = () => Math.max(1, Math.round(minutes("SURGE_MULTIPLIER", 2)))

/** Minutes between two instants; NaN for an unparseable pickup. */
function noticeMinutes(pickupIso: string, from: Date): number {
  return (new Date(pickupIso).getTime() - from.getTime()) / 60_000
}

export function unitsForLeg(pickupIso: string, from: Date): number {
  const notice = noticeMinutes(pickupIso, from)
  return notice < SURGE_WINDOW_MINUTES() ? SURGE_MULTIPLIER() : 1
}

export type FareUnits = {
  /** The vehicle line's quantity: 1 per leg, the multiplier per short-notice leg. */
  units: number
  /** How many legs the trip has. */
  legs: number
  /** How many of those legs are charged at the short-notice rate. */
  surged_legs: number
  multiplier: number
  window_hours: number
}

/**
 * The units for a trip, as seen from `from` (now, for a quote; the cart's
 * creation time, when checking a completed booking).
 *
 * With no pickup time — a quote for "what does this destination cost" — there
 * is nothing to be short notice about, so every leg is one unit.
 */
export function fareUnits(
  pickupAt: string | null | undefined,
  returnAt: string | null | undefined,
  from: Date
): FareUnits {
  const legs = [pickupAt, returnAt].filter((x): x is string => Boolean(x))
  const perLeg = legs.map((iso) => unitsForLeg(iso, from))
  const count = Math.max(1, legs.length || (returnAt ? 2 : 1))

  return {
    units: perLeg.length ? perLeg.reduce((a, b) => a + b, 0) : count,
    legs: perLeg.length || count,
    surged_legs: perLeg.filter((u) => u > 1).length,
    multiplier: SURGE_MULTIPLIER(),
    window_hours: SURGE_WINDOW_MINUTES() / 60,
  }
}

/** Whether a pickup is far enough away to book online at all. */
export function meetsLeadTime(pickupIso: string, from: Date): boolean {
  const notice = noticeMinutes(pickupIso, from)
  return Number.isFinite(notice) && notice >= MIN_LEAD_MINUTES()
}
