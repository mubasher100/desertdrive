import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { representativePoint, toRing } from "../../../lib/geo"
import { FARE_ZONE_MODULE } from "../../../modules/fare-zone"

type ZoneRow = {
  code: string
  name_en: string
  name_ar: string
  polygon: unknown
  rank: number
  active: boolean
}

/**
 * GET /store/zones
 *
 * The areas the owner has drawn, as searchable destinations.
 *
 * Drawing "Viva Bahriya" in the admin should make it findable in the search
 * box the same day, without waiting on any external place database — this is
 * what makes that true. Each zone carries a point inside its own outline, so
 * choosing it prices by that zone and not by whatever band surrounds it.
 *
 * Public and cacheable: it is the same for every visitor and changes only when
 * the owner draws something. It contains no price.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: { listFareZones: (f: object, c?: object) => Promise<ZoneRow[]> } =
    req.scope.resolve(FARE_ZONE_MODULE)

  const rows = await service.listFareZones({ active: true }, { order: { rank: "ASC" } }).catch(() => [])

  const zones = rows
    .map((z) => {
      const point = representativePoint(toRing(z.polygon))
      return point ? { code: z.code, name_en: z.name_en, name_ar: z.name_ar, lat: point.lat, lng: point.lng } : null
    })
    .filter(Boolean)

  // Five minutes: an area drawn in the admin shows up in search within the
  // cache window, the same promise the fares make.
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=600")
  res.json({ zones })
}
