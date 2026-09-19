import { findArea, type Area } from "@lib/data/areas"
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
  area: Area
  /** YYYY-MM-DD, as picked. */
  date: string
  /** HH:MM, 24h, as picked. */
  time: string
  passengers: number
  luggage: number
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
  const areaId = first(params.area)
  const date = first(params.date) ?? ""
  const time = first(params.time) ?? ""
  const passengers = Number(first(params.passengers))
  const luggage = Number(first(params.luggage))

  if (direction !== "arrival" && direction !== "departure") return null

  const area = findArea(areaId)
  if (!area) return null

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  if (!/^\d{2}:\d{2}$/.test(time)) return null

  if (!Number.isInteger(passengers) || passengers < 1 || passengers > 16) return null
  if (!Number.isInteger(luggage) || luggage < 0 || luggage > 20) return null

  return { direction, area, date, time, passengers, luggage }
}

/** The inverse of parseTrip, for building the next step's URL. */
export function tripToQuery(trip: Trip, extra?: Record<string, string>): string {
  const q = new URLSearchParams({
    direction: trip.direction,
    area: trip.area.id,
    date: trip.date,
    time: trip.time,
    passengers: String(trip.passengers),
    luggage: String(trip.luggage),
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
