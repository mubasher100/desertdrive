import {
  coordsOf,
  destinationFromQuery,
  destinationToQuery,
  type Destination,
} from "@lib/booking/destination"
import type { Language } from "@lib/util/locale"

/**
 * The trip as it travels through the funnel's URLs.
 *
 * It is carried in query parameters from the search widget to results to
 * details, and only lands somewhere persistent when it becomes cart.metadata
 * at add-to-cart. Keeping it in the URL means every step is a real,
 * shareable, back-button-safe page, and a refresh loses nothing.
 *
 * Pure module — no "use server" — so both server and client components can
 * import the parsers without every export needing to be a Server Action.
 */

export type Direction = "arrival" | "departure"

export type Trip = {
  direction: Direction
  /** A curated area, or an address the customer searched for. */
  destination: Destination
  /** YYYY-MM-DD, as picked. */
  date: string
  /** HH:MM, 24h, as picked. */
  time: string
  passengers: number
  luggage: number
  /**
   * The way back, when the customer asked for one. Both fields are set or
   * neither is — a half-filled return is treated as no return by the parser.
   *
   * The return leg is the mirror of the outbound: the same vehicle, the same
   * area, the opposite direction. It is one booking with two legs rather than
   * two bookings, because the customer thinks of it as one trip and the owner
   * dispatches it as one job with two pickups.
   */
  returnDate?: string
  returnTime?: string
}

/** Two legs when a return was asked for, otherwise one. Line-item quantity, and the multiplier on the fare. */
export function legsOf(trip: Trip): 1 | 2 {
  return trip.returnDate && trip.returnTime ? 2 : 1
}

export type SearchParams = Record<string, string | string[] | undefined>

const first = (v: string | string[] | undefined) =>
  Array.isArray(v) ? v[0] : v

/**
 * Parses and VALIDATES the trip from query parameters. Returns null on anything
 * malformed — the caller sends the visitor back to the search widget rather
 * than rendering half a trip.
 */
export function parseTrip(params: SearchParams): Trip | null {
  const direction = first(params.direction)
  const date = first(params.date) ?? ""
  const time = first(params.time) ?? ""
  const passengers = Number(first(params.passengers))
  const luggage = Number(first(params.luggage))
  const returnDate = first(params.return_date) ?? ""
  const returnTime = first(params.return_time) ?? ""

  if (direction !== "arrival" && direction !== "departure") return null

  const destination = destinationFromQuery((key) => first(params[key]))
  if (!destination) return null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!/^\d{2}:\d{2}$/.test(time)) return null

  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 16) return null
  if (!Number.isInteger(luggage) || luggage < 0 || luggage > 20) return null

  const trip: Trip = { direction, destination, date, time, passengers, luggage }

  // A return needs both halves and has to come after the outbound. Anything
  // else is dropped rather than rejected: a one-way is still a valid trip, and
  // losing the return is better than sending the customer back to the search.
  if (/^\d{4}-\d{2}-\d{2}$/.test(returnDate) && /^\d{2}:\d{2}$/.test(returnTime)) {
    const out = new Date(`${date}T${time}:00+03:00`).getTime()
    const back = new Date(`${returnDate}T${returnTime}:00+03:00`).getTime()
    if (back > out) {
      trip.returnDate = returnDate
      trip.returnTime = returnTime
    }
  }

  return trip
}

/** Where to price from. The server decides the band; this is only the point. */
export function tripCoords(trip: Trip): { lat: number; lng: number } {
  return coordsOf(trip.destination)
}

/** The inverse of parseTrip, for building the next step's URL. */
export function tripToQuery(trip: Trip, extra?: Record<string, string>): string {
  const q = new URLSearchParams({
    direction: trip.direction,
    ...destinationToQuery(trip.destination),
    date: trip.date,
    time: trip.time,
    passengers: String(trip.passengers),
    luggage: String(trip.luggage),
    ...(trip.returnDate && trip.returnTime
      ? { return_date: trip.returnDate, return_time: trip.returnTime }
      : {}),
    ...extra,
  })
  return q.toString()
}

/**
 * The pickup instant as ISO 8601 with Qatar's fixed +03:00 offset. Qatar does
 * not observe DST, so the offset never changes and no timezone library is
 * needed. This is what goes on cart.metadata.pickup_at.
 */
export function pickupAtIso(trip: Trip): string {
  return `${trip.date}T${trip.time}:00+03:00`
}

/** The return leg's pickup instant, or null on a one-way. */
export function returnAtIso(trip: Trip): string | null {
  return trip.returnDate && trip.returnTime ? `${trip.returnDate}T${trip.returnTime}:00+03:00` : null
}

/** "Tue 14 Oct, 14:30" for the return leg, or null on a one-way. */
export function formatReturn(trip: Trip, language: Language): string | null {
  if (!trip.returnDate || !trip.returnTime) return null
  return formatPickup({ ...trip, date: trip.returnDate, time: trip.returnTime }, language)
}

/** "Tue 14 Oct, 14:30" in the visitor's language, Western digits always. */
export function formatPickup(trip: Trip, language: Language): string {
  const d = new Date(pickupAtIso(trip))
  const locale = language === "ar" ? "ar-QA-u-nu-latn" : "en-QA"
  const date = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "Asia/Qatar",
  }).format(d)
  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Qatar",
  }).format(d)
  return `${date}, ${time}`
}
