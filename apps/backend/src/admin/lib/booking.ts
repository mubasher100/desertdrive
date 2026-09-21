import type { HttpTypes } from "@medusajs/framework/types"

/**
 * The booking that rides on an order's metadata. Key names are the contract
 * fixed in CLAUDE.md ("Booking details ride on metadata"); the storefront
 * writes them, the confirmation email and this admin UI read them.
 */
export type BookingMeta = {
  direction: "arrival" | "departure"
  pickup_at: string
  flight_number: string | null
  passengers: number
  luggage: number
  address: string
  band_code: string
  distance_km: number | null
  contact_name: string
  contact_phone: string
  contact_email: string
  notes: string | null
  locale: string
  terms_accepted_at: string | null
}

export function readBooking(order: Pick<HttpTypes.AdminOrder, "metadata">): BookingMeta | null {
  const m = (order.metadata ?? {}) as Record<string, unknown>
  if (!m.pickup_at || !m.direction) return null
  const str = (v: unknown) => (v == null ? "" : String(v))
  const num = (v: unknown) => (v == null || v === "" || Number.isNaN(Number(v)) ? null : Number(v))
  return {
    direction: m.direction === "departure" ? "departure" : "arrival",
    pickup_at: str(m.pickup_at),
    flight_number: m.flight_number ? str(m.flight_number) : null,
    passengers: num(m.passengers) ?? 0,
    luggage: num(m.luggage) ?? 0,
    address: str(m.address),
    band_code: str(m.band_code),
    distance_km: num(m.distance_km),
    contact_name: str(m.contact_name),
    contact_phone: str(m.contact_phone),
    contact_email: str(m.contact_email),
    notes: m.notes ? str(m.notes) : null,
    locale: str(m.locale) || "en",
    terms_accepted_at: m.terms_accepted_at ? str(m.terms_accepted_at) : null,
  }
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
