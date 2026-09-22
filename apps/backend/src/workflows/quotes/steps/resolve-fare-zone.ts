import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { resolveZone } from "../../../lib/geo"
import { FARE_ZONE_MODULE } from "../../../modules/fare-zone"

export type ResolveFareZoneInput = {
  lat: number
  lng: number
}

export type ResolvedZone = {
  code: string
  name_en: string
  name_ar: string
} | null

type FareZoneRecord = {
  code: string
  name_en: string
  name_ar: string
  polygon: unknown
  rank: number
  active: boolean
}

/**
 * Finds the drawn area a destination falls in, if any.
 *
 * Runs alongside band resolution rather than instead of it: a zone answers
 * "where is this" and a band answers "how far is it", and the quote uses the
 * zone's price when one exists and the band's otherwise. That ordering is what
 * lets an area be drawn today and priced next week without taking it off sale.
 *
 * Returning null is the ordinary case — most of Qatar has no zone drawn over
 * it — so this never throws for a miss.
 *
 * Read-only, so no compensation.
 */
export const resolveFareZoneStep = createStep(
  "resolve-fare-zone",
  async (input: ResolveFareZoneInput, { container }) => {
    const service: { listFareZones: (f: object) => Promise<FareZoneRecord[]> } =
      container.resolve(FARE_ZONE_MODULE)

    // Zones are a handful of rows the owner maintains by hand; listing them all
    // is cheaper than any spatial query we could build on top of JSON.
    const zones = await service.listFareZones({}).catch(() => [])

    const zone = resolveZone({ lat: input.lat, lng: input.lng }, zones)

    return new StepResponse<ResolvedZone>(
      zone ? { code: zone.code, name_en: zone.name_en, name_ar: zone.name_ar } : null
    )
  }
)
