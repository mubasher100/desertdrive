/**
 * Distance geometry for fare-band resolution.
 *
 * Deliberately pure and dependency-free: no container, no DB, no network. The
 * number this produces decides what every customer is charged, so it must be
 * trivially unit-testable and must never depend on a third-party service being
 * up. Google Places supplies coordinates for the address; it never supplies a
 * distance and never supplies a fare.
 */

/** Mean Earth radius in kilometres. */
const EARTH_RADIUS_KM = 6371

const toRad = (deg: number): number => (deg * Math.PI) / 180

export type LatLng = { lat: number; lng: number }

/**
 * Great-circle ("as the crow flies") distance in kilometres.
 *
 * ⚠️ This is STRAIGHT-LINE distance and runs roughly 20–30% short of the road
 * distance a driver actually covers. That is accounted for in the band bounds,
 * which are expressed in straight-line km for this exact reason — a 25 km road
 * trip is about 20 km as the crow flies.
 *
 * Do not "correct" this with a road-distance API. Fares are fixed per band, and
 * introducing a live distance lookup would put the only revenue path on the site
 * behind a third-party dependency.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** The shape band resolution needs. Matches the FareBand data model. */
export type BandBounds = {
  code: string
  max_km: number | null
  rank: number
}

/**
 * Picks the band a distance falls into: the first band by ascending `rank` whose
 * `max_km` the distance does not exceed. A `null` max_km is unbounded and acts as
 * the catch-all, so it must sort last.
 *
 * Returns `null` when no band matches — which can only happen if the band table
 * has no unbounded catch-all. Callers must treat that as "cannot quote this
 * trip", never as "use the most expensive band": silently overcharging is worse
 * than declining.
 */
export function resolveBand<T extends BandBounds>(
  km: number,
  bands: readonly T[]
): T | null {
  if (!Number.isFinite(km) || km < 0) {
    return null
  }

  const ordered = [...bands].sort((a, b) => a.rank - b.rank)

  for (const band of ordered) {
    if (band.max_km === null || km <= band.max_km) {
      return band
    }
  }

  return null
}

/**
 * Validates a coordinate pair supplied by a client.
 *
 * The storefront sends coordinates and nothing else that touches price, so this
 * is the boundary where untrusted numeric input is rejected. NaN would otherwise
 * propagate through haversine and land in `resolveBand` as a non-match.
 */
export function isValidLatLng(value: unknown): value is LatLng {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const { lat, lng } = value as Partial<LatLng>

  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}
