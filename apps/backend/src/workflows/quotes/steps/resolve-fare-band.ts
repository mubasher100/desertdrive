import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { getAirportOrigin } from "../../../lib/airport"
import { haversineKm, resolveBand } from "../../../lib/geo"
import { FARE_BAND_MODULE } from "../../../modules/fare-band"

export type ResolveFareBandInput = {
  lat: number
  lng: number
}

/** A FareBand row, as returned by the module service. */
type FareBandRecord = {
  id: string
  code: string
  name_en: string
  name_ar: string
  max_km: number | null
  rank: number
}

export type ResolveFareBandOutput = {
  distance_km: number
  band: {
    id: string
    code: string
    name_en: string
    name_ar: string
  }
}

/**
 * Turns a coordinate into a distance band.
 *
 * ⚠️ THIS IS THE SECURITY BOUNDARY OF THE PRICING MODEL.
 *
 * The client sends coordinates and nothing else. It does not say which band
 * applies, which variant to use, or what the fare is — every one of those would
 * be a price field sitting in devtools. The band is decided here, server-side,
 * from data the client cannot influence beyond a lat/lng pair.
 *
 * Read-only: no mutation, so no compensation function is needed.
 */
export const resolveFareBandStep = createStep(
  "resolve-fare-band",
  async (input: ResolveFareBandInput, { container }) => {
    const fareBandService: any = container.resolve(FARE_BAND_MODULE)

    const bands: FareBandRecord[] = await fareBandService.listFareBands({})

    if (!bands.length) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No fare bands are configured. Run: npx medusa exec ./src/scripts/seed-fleet.ts"
      )
    }

    const distanceKm = haversineKm(getAirportOrigin(), {
      lat: input.lat,
      lng: input.lng,
    })

    const band = resolveBand(distanceKm, bands)

    /**
     * No match means the band table has no unbounded catch-all. Decline rather
     * than fall back to the most expensive band — silently overcharging someone
     * is a worse failure than telling them we cannot quote the trip.
     */
    if (!band) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `No fare band covers ${distanceKm.toFixed(1)} km. One band must have a ` +
          "null max_km to act as the catch-all."
      )
    }

    return new StepResponse<ResolveFareBandOutput>({
      // One decimal is plenty. Publishing more implies a precision that
      // straight-line distance does not have.
      distance_km: Math.round(distanceKm * 10) / 10,
      band: {
        id: band.id,
        code: band.code,
        name_en: band.name_en,
        name_ar: band.name_ar,
      },
    })
  }
)
