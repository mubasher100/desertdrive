import type { HttpTypes } from "@medusajs/framework/types"

/**
 * The booking that rides on an order's metadata. Key names are the contract
 * fixed in CLAUDE.md ("Booking details ride on metadata"); the storefront
 * writes them, the confirmation email and this admin UI read them.
 */
export type BookingMeta = {
  direction: "arrival" | "departure"
  pickup_at: string
  /** ISO 8601 on a return booking, null on a one-way. */
  return_at: string | null
  flight_number: string | null
  passengers: number
  luggage: number
  address: string
  lat: number | null
  lng: number | null
  band_code: string
  distance_km: number | null
  contact_name: string
  contact_phone: string
  contact_email: string
  notes: string | null
  /** Booked under 12 hours ahead, at the short-notice fare. The owner needs a driver fast. */
  short_notice: boolean
  /**
   * The extras the customer paid for. English only: this is what the driver
   * reads off the job sheet at 4am, and the rule in CLAUDE.md is that form
   * values the driver reads stay English even on an Arabic booking.
   *
   * Empty on every booking taken before add-ons existed.
   */
  add_ons: Array<{
    title: string
    quantity: number
    /** The words to print on a meet & greet board, when this add-on is one. */
    note: string | null
    /** A picture to print beside them. Always one of our own upload URLs. */
    image_url: string | null
  }>
  locale: string
  terms_accepted_at: string | null
  /** The owner's own state for the booking — see lib/booking-status.ts on the backend. */
  status: "active" | "cancelled"
  cancelled_at: string | null
  cancel_reason: string | null
  /** QAR recorded as refunded, after it was refunded in the SkipCash portal. */
  refunded_total: number
}

export function readBooking(order: Pick<HttpTypes.AdminOrder, "metadata">): BookingMeta | null {
  const m = (order.metadata ?? {}) as Record<string, unknown>
  if (!m.pickup_at || !m.direction) return null
  const str = (v: unknown) => (v == null ? "" : String(v))
  const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    direction: m.direction === "departure" ? "departure" : "arrival",
    pickup_at: str(m.pickup_at),
    return_at: m.return_at ? str(m.return_at) : null,
    flight_number: m.flight_number ? str(m.flight_number) : null,
    passengers: num(m.passengers) ?? 0,
    luggage: num(m.luggage) ?? 0,
    address: str(m.address),
    lat: num(m.lat),
    lng: num(m.lng),
    band_code: str(m.band_code),
    distance_km: num(m.distance_km),
    contact_name: str(m.contact_name),
    contact_phone: str(m.contact_phone),
    contact_email: str(m.contact_email),
    notes: m.notes ? str(m.notes) : null,
    short_notice: m.short_notice === true,
    // Defensive: JSON off a database column, written by a different app.
    add_ons: Array.isArray(m.add_ons)
      ? (m.add_ons as Array<Record<string, unknown>>)
          .filter((a) => a && a.title != null && Number(a.quantity) > 0)
          .map((a) => ({
            title: str(a.title),
            quantity: Number(a.quantity),
            note: a.note ? str(a.note) : null,
            // Rendered as a link the owner clicks, so only https is honoured.
            image_url:
              typeof a.image_url === "string" && a.image_url.startsWith("https://")
                ? a.image_url
                : null,
          }))
      : [],
    locale: str(m.locale) || "en",
    terms_accepted_at: m.terms_accepted_at ? str(m.terms_accepted_at) : null,
    status: m.booking_status === "cancelled" ? "cancelled" : "active",
    cancelled_at: m.cancelled_at ? str(m.cancelled_at) : null,
    cancel_reason: m.cancel_reason ? str(m.cancel_reason) : null,
    refunded_total: num(m.refunded_total) ?? 0,
  }
}

/** The badge a booking wears: its state, and "refunded" once money went back. */
export function statusBadge(b: BookingMeta, paid: number, captured: boolean): { label: string; color: "orange" | "green" | "red" | "purple" | "grey" } {
  const refund = b.refunded_total > 0 ? (b.refunded_total >= paid - 0.001 ? "refunded" : "part refunded") : null
  // Cancelled outranks refunded: "Cancelled · refunded" says both, and the
  // owner needs to see first that the trip is off.
  if (b.status === "cancelled") return { label: refund ? `Cancelled · ${refund}` : "Cancelled", color: "red" }
  if (refund) return { label: refund === "refunded" ? "Refunded" : "Part refunded", color: "purple" }
  // Paid is confirmed — there is no confirm step (owner, 26 Oct 2026).
  if (captured) return { label: "Confirmed", color: "green" }
  return { label: "Not paid", color: "orange" }
}

/** "$64.84 (236 QAR)" — the site's own currency rule: dollars first, riyals as charged. */
export function money(qar: number): string {
  const cents = Math.round((qar / 3.64) * 100)
  const usd = cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2)
  const fils = Math.round(qar * 100)
  const q = fils % 100 === 0 ? String(fils / 100) : (fils / 100).toFixed(2)
  return `$${usd} (${q} QAR)`
}

/** A WhatsApp chat with the customer, opened with their booking reference already typed. */
export function whatsappCustomerUrl(b: BookingMeta, reference: string): string | null {
  const digits = b.contact_phone.replace(/\D/g, "")
  if (!digits) return null
  const first = b.contact_name.split(/\s+/)[0] || ""
  return `https://wa.me/${digits}?text=${encodeURIComponent(`Hello ${first}, this is Desert Drive about your booking ${reference}.`)}`
}

/** Qatar has one time zone and no DST; every pickup is shown in it regardless of where the admin sits. */
export function formatPickup(iso: string): { date: string; time: string } {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: "" }
  return {
    date: new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Qatar" }).format(d),
    time: new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Qatar" }).format(d),
  }
}

export function routeLabel(b: BookingMeta): string {
  return b.direction === "departure" ? `${b.address} → Hamad International` : `Hamad International → ${b.address}`
}

/** The return leg reads as the mirror of the outbound. */
export function returnRouteLabel(b: BookingMeta): string {
  return b.direction === "departure" ? `Hamad International → ${b.address}` : `${b.address} → Hamad International`
}

/**
 * Where to drive, as a link.
 *
 * A pinned villa has coordinates and no useful street name, so the address
 * line alone does not get a driver there. This does.
 */
export function mapsUrl(b: BookingMeta): string | null {
  return b.lat != null && b.lng != null ? `https://www.google.com/maps?q=${b.lat},${b.lng}` : null
}

export function whatsappUrl(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`
}

/**
 * How the customer chose to pay, read off the payment collection. Cash bookings
 * authorise through the manual provider and are captured when the driver is
 * paid; card bookings arrive captured by SkipCash.
 */
export type PaymentState = {
  method: "card" | "cash"
  captured: boolean
  paymentId: string | null
  amount: number
}

export function readPayment(order: HttpTypes.AdminOrder): PaymentState {
  const payments = (order.payment_collections ?? []).flatMap((pc) => pc.payments ?? [])
  const payment = payments[0]
  const method = payment?.provider_id === "pp_system_default" ? "cash" : "card"
  return {
    method,
    captured: !!payment?.captured_at,
    paymentId: payment?.id ?? null,
    amount: Number(payment?.amount ?? order.total ?? 0),
  }
}
