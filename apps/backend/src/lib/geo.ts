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

/** A drawn area: an ordered ring of points, treated as closed. */
export type Ring = readonly LatLng[]

/**
 * Whether a point lies inside a polygon, by ray casting.
 *
 * A horizontal ray runs east from the point; crossing the outline an odd
 * number of times means inside. Edges are tested half-open on latitude
 * (`>` on one end, `<=` on the other) so a point level with a vertex is
 * counted once rather than twice — the classic double-count that puts points
 * on a horizontal edge outside their own zone.
 *
 * Plate carrée: latitude and longitude are treated as plane coordinates. Over
 * a zone a few kilometres across, at Qatar's latitude, the error is far below
 * the precision of a drawn outline. Do not reuse this for country-sized
 * polygons or anything spanning the antimeridian.
 */
export function pointInRing(point: LatLng, ring: Ring): boolean {
  if (!ring || ring.length < 3) {
    return false
  }

  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    if (!a || !b) continue

    const straddles = a.lat > point.lat !== b.lat > point.lat
    if (!straddles) continue

    // Longitude where edge a-b crosses the point's latitude.
    const crossLng = ((b.lng - a.lng) * (point.lat - a.lat)) / (b.lat - a.lat) + a.lng
    if (point.lng < crossLng) {
      inside = !inside
    }
  }

  return inside
}

/** The shape zone resolution needs. Matches the FareZone data model. */
export type ZoneShape = {
  code: string
  polygon: unknown
  rank: number
  active?: boolean
}

/** Reads a stored polygon back into points, dropping anything malformed. */
export function toRing(polygon: unknown): LatLng[] {
  if (!Array.isArray(polygon)) return []
  return polygon.filter((p): p is LatLng => isValidLatLng(p))
}

/**
 * The first active zone containing this point, by ascending rank.
 *
 * Rank decides overlaps, and overlaps are the point: a compound inside a
 * district needs to win over the district, so the more specific zone carries
 * the lower rank. Returns null when the point is in no zone at all — the
 * ordinary case, which falls through to distance bands.
 */
export function resolveZone<T extends ZoneShape>(point: LatLng, zones: readonly T[]): T | null {
  const ordered = [...zones]
    .filter((z) => z.active !== false)
    .sort((a, b) => a.rank - b.rank)

  for (const zone of ordered) {
    if (pointInRing(point, toRing(zone.polygon))) {
      return zone
    }
  }

  return null
}

/**
 * A point guaranteed to sit inside a zone, for searching by its name.
 *
 * The area centroid is the natural choice and is right for the convex
 * outlines a person draws around a district. It can fall outside a concave
 * one — a crescent, or Doha's coastline — so it is tested and only used if it
 * is genuinely inside; otherwise the vertex average, and failing that the
 * first vertex, which is on the boundary but never wrong by much.
 *
 * It matters because this point is what gets priced: pick one outside the
 * polygon and searching for "The Pearl" quotes whatever band surrounds it.
 */
export function representativePoint(ring: Ring): LatLng | null {
  if (!ring || ring.length < 3) {
    return ring?.[0] ?? null
  }

  let twiceArea = 0
  let lat = 0
  let lng = 0

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]
    const b = ring[j]
    const cross = b.lng * a.lat - a.lng * b.lat
    twiceArea += cross
    lat += (a.lat + b.lat) * cross
    lng += (a.lng + b.lng) * cross
  }

  if (twiceArea !== 0) {
    const centroid = { lat: lat / (3 * twiceArea), lng: lng / (3 * twiceArea) }
    if (pointInRing(centroid, ring)) {
      return centroid
    }
  }

  const mean = {
    lat: ring.reduce((t, p) => t + p.lat, 0) / ring.length,
    lng: ring.reduce((t, p) => t + p.lng, 0) / ring.length,
  }

  return pointInRing(mean, ring) ? mean : ring[0]
}
