/**
 * How far ahead a pickup has to be.
 *
 * A booking taken for a time that has already passed, or for ten minutes from
 * now, cannot be driven: the owner has to find a car, brief a driver and get
 * them across Doha. Accepting one produces a guaranteed no-show and an argument
 * about a refund, so the funnel refuses it at the first step and again on the
 * server before a cart is created.
 *
 * Six hours is the OWNER'S RULE, given on 27 Sept 2026 — not a guess. It
 * replaced a three-hour placeholder. It pairs with the short-notice surcharge
 * in `surge.ts`: under 12 hours costs double, under 6 hours is not bookable
 * here at all.
 *
 * Short-notice airport work is still taken by phone, which is exactly what the
 * "too soon" message offers — a WhatsApp link, not a dead end. Overridable with
 * `NEXT_PUBLIC_MIN_LEAD_MINUTES` rather than editing here.
 */

export const MIN_LEAD_MINUTES = Number(process.env.NEXT_PUBLIC_MIN_LEAD_MINUTES ?? 360)

/** Qatar is UTC+03:00 year-round — no DST, so the offset is a constant. */
const QATAR_OFFSET_MS = 3 * 60 * 60 * 1000

export type LeadProblem = "past" | "tooSoon"

/** The pickup instant for a date and time as the customer picked them, in Qatar. */
export function pickupInstant(date: string, time: string): Date {
  return new Date(`${date}T${time}:00+03:00`)
}

/**
 * Today's date in Qatar, as YYYY-MM-DD.
 *
 * Computed from the absolute clock rather than the device's timezone, so a
 * customer booking at 01:00 from London gets Qatar's date — which is the date
 * their driver works to.
 */
export function qatarToday(now: Date = new Date()): string {
  return new Date(now.getTime() + QATAR_OFFSET_MS).toISOString().slice(0, 10)
}

/** The earliest bookable instant: now plus the lead time. */
export function earliestPickup(now: Date = new Date()): Date {
  return new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000)
}

/**
 * The earliest date and time a customer may pick, in Qatar terms — used to set
 * the `min` attributes so the native pickers guide before they reject.
 */
export function earliestPickupFields(now: Date = new Date()): { date: string; time: string } {
  const shifted = new Date(earliestPickup(now).getTime() + QATAR_OFFSET_MS)
  return { date: shifted.toISOString().slice(0, 10), time: shifted.toISOString().slice(11, 16) }
}

/**
 * Why this pickup cannot be booked, or null if it can.
 *
 * "past" and "tooSoon" are separated because they need different words: one is
 * a mistake to correct, the other is a real booking we would like to take by
 * phone.
 */
export function checkLeadTime(date: string, time: string, now: Date = new Date()): LeadProblem | null {
  const pickup = pickupInstant(date, time)
  if (Number.isNaN(pickup.getTime())) {
    return null // malformed input is the parser's problem, not this rule's
  }
  if (pickup.getTime() <= now.getTime()) {
    return "past"
  }
  if (pickup.getTime() < earliestPickup(now).getTime()) {
    return "tooSoon"
  }
  return null
}

/** The same check against an ISO pickup instant, for the server-side gate. */
export function checkLeadTimeIso(iso: string, now: Date = new Date()): LeadProblem | null {
  const pickup = new Date(iso)
  if (Number.isNaN(pickup.getTime())) {
    return null
  }
  if (pickup.getTime() <= now.getTime()) {
    return "past"
  }
  if (pickup.getTime() < earliestPickup(now).getTime()) {
    return "tooSoon"
  }
  return null
}

/** "3 hours" / "90 minutes", for the message that explains the rule. */
export function leadTimeLabel(language: "en" | "ar"): string {
  const hours = MIN_LEAD_MINUTES / 60
  if (Number.isInteger(hours)) {
    if (language === "ar") {
      return hours === 1 ? "ساعة واحدة" : hours === 2 ? "ساعتين" : `${hours} ساعات`
    }
    return `${hours} hour${hours === 1 ? "" : "s"}`
  }
  return language === "ar" ? `${MIN_LEAD_MINUTES} دقيقة` : `${MIN_LEAD_MINUTES} minutes`
}
