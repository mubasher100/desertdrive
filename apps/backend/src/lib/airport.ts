import { isValidLatLng, type LatLng } from "./geo"

/**
 * Hamad International Airport reference point (25°16′23″N 51°36′29″E).
 *
 * EVERY fare in the system keys off this single coordinate: the distance band,
 * and therefore the price, is straight-line distance from here. A few hundred
 * metres of error shifts trips near a band boundary into the wrong band.
 *
 * This is the published airport reference point, not the passenger terminal —
 * the terminal sits roughly 1.5 km south-east. The ARP is used because the band
 * bounds were calibrated against it; changing to the terminal means recalibrating
 * every bound, not just this constant.
 */
const HAMAD_INTERNATIONAL_ARP: LatLng = {
  lat: 25.273056,
  lng: 51.608056,
}

/**
 * Resolves the origin point for distance calculation.
 *
 * Overridable via AIRPORT_LAT / AIRPORT_LNG so the boundary can be recalibrated
 * without a deploy, but a malformed override throws rather than silently falling
 * back — a bad origin would misprice every booking, quietly, in one direction.
 */
export function getAirportOrigin(): LatLng {
  const rawLat = process.env.AIRPORT_LAT
  const rawLng = process.env.AIRPORT_LNG

  if (rawLat === undefined && rawLng === undefined) {
    return HAMAD_INTERNATIONAL_ARP
  }

  if (rawLat === undefined || rawLng === undefined) {
    throw new Error(
      "AIRPORT_LAT and AIRPORT_LNG must be set together. Set both, or neither " +
        "to use the Hamad International reference point."
    )
  }

  const candidate = { lat: Number(rawLat), lng: Number(rawLng) }

  if (!isValidLatLng(candidate)) {
    throw new Error(
      `AIRPORT_LAT/AIRPORT_LNG are not a valid coordinate: got "${rawLat}", ` +
        `"${rawLng}". Every fare is measured from this point, so this is fatal ` +
        "rather than something to fall back from."
    )
  }

  return candidate
}
