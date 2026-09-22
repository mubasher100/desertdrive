import { findArea, areaName, type Area } from "@lib/data/areas"
import type { Language } from "@lib/util/locale"

/**
 * Where the customer is going: a curated area, or any address they searched.
 *
 * Two shapes rather than one, because the trust model differs. A curated area
 * carries coordinates the project set and reviewed; a searched place carries
 * coordinates that arrived from Google through the customer's browser. The
 * fare is resolved from coordinates server-side either way — the client never
 * says which band applies — but a browser-supplied point still has to be
 * sanity-checked before it is priced, which is what `inQatar` is for.
 */
export type Destination =
  | { kind: "area"; area: Area }
  | {
      kind: "place"
      /** Google Places id, kept so a booking can be traced back to a real place. */
      place_id: string
      /** The formatted address, in English: the driver reads it off the job sheet. */
      address: string
      lat: number
      lng: number
    }

/**
 * A generous box around Qatar: roughly Ruwais in the north to Abu Samra in the
 * south, the west coast to the east coast, with room to spare.
 *
 * It is a guard, not a service area. Its job is to stop a tampered URL pricing
 * a trip to Paris against a Doha fare band, not to decide where Desert Drive
 * will drive — the bands already do that, and anywhere unpriced falls through
 * to "contact us for a quote".
 */
const QATAR_BOUNDS = { minLat: 24.3, maxLat: 26.3, minLng: 50.5, maxLng: 51.8 }

export function inQatar(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= QATAR_BOUNDS.minLat &&
    lat <= QATAR_BOUNDS.maxLat &&
    lng >= QATAR_BOUNDS.minLng &&
    lng <= QATAR_BOUNDS.maxLng
  )
}

export function coordsOf(d: Destination): { lat: number; lng: number } {
  return d.kind === "area" ? { lat: d.area.lat, lng: d.area.lng } : { lat: d.lat, lng: d.lng }
}

/** What the customer sees, in their language. */
export function destinationName(d: Destination, language: Language): string {
  return d.kind === "area" ? areaName(d.area, language) : d.address
}

/**
 * What the driver reads off the job sheet — English, always, regardless of the
 * language the customer booked in. See CLAUDE.md, localisation: the driver
 * reads this aloud at 4am.
 */
export function destinationForDriver(d: Destination): string {
  return d.kind === "area" ? d.area.name_en : d.address
}

/** The stable id for a curated area, or null for a searched place. */
export function areaIdOf(d: Destination): string | null {
  return d.kind === "area" ? d.area.id : null
}

export function placeIdOf(d: Destination): string | null {
  return d.kind === "place" ? d.place_id : null
}

/** Query parameters that carry this destination to the next step. */
export function destinationToQuery(d: Destination): Record<string, string> {
  if (d.kind === "area") {
    return { area: d.area.id }
  }
  return {
    place_id: d.place_id,
    address: d.address,
    lat: String(d.lat),
    lng: String(d.lng),
  }
}

/**
 * Reads a destination back out of query parameters, or null if it is not
 * usable. An unknown area id, a missing coordinate or a point outside Qatar
 * all return null, and the caller sends the visitor back to the search rather
 * than pricing something it cannot vouch for.
 */
export function destinationFromQuery(get: (key: string) => string | undefined): Destination | null {
  const areaId = get("area")
  if (areaId) {
    const area = findArea(areaId)
    return area ? { kind: "area", area } : null
  }

  const placeId = get("place_id")
  const address = (get("address") ?? "").trim()
  const lat = Number(get("lat"))
  const lng = Number(get("lng"))

  if (!placeId || !address || !inQatar(lat, lng)) {
    return null
  }

  // Bounded so a pathological URL cannot push an essay onto the order.
  return { kind: "place", place_id: placeId.slice(0, 200), address: address.slice(0, 200), lat, lng }
}
