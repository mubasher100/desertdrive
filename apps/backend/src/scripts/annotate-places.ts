import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLACE_INDEX_MODULE } from "../modules/place-index"
import { haversineKm } from "../lib/geo"
import { searchText } from "../lib/osm-places"

type Row = {
  id: string
  name_en: string
  name_ar: string | null
  kind: string
  context: string | null
  search: string
  lat: number
  lng: number
}

type Service = {
  listPlaces: (filters: object, config?: object) => Promise<Row[]>
  updatePlaces: (data: object) => Promise<unknown>
}

/** Areas big enough to be worth naming as "where is this". */
const AREA_KINDS = new Set(["city", "district", "island"])

/**
 * Names the district each place sits in, as the subtitle under its name.
 *
 *   npx medusa exec ./src/scripts/annotate-places.ts
 *
 * Without this the index is barely usable at its full size. Qatar has upwards
 * of thirty branches of the same coffee chain and a dozen of the same
 * supermarket; a dropdown reading "Starbucks / Starbucks / Starbucks" asks the
 * customer to guess, and a wrong guess is the wrong pickup point and the wrong
 * fare. "Starbucks — Al Sadd" is a choice they can actually make.
 *
 * Runs after import-places, offline and over the whole index at once, because
 * working out which district a place is in needs the districts — which arrive
 * in the same import.
 *
 * Nearest-centre rather than point-in-polygon: OSM gives most districts as a
 * single labelled point, not an outline, so there is no polygon to test
 * against. It is an approximation, and it is only ever a subtitle — nothing
 * here decides a fare. The fare comes from the place's own coordinates, which
 * are exact.
 */
export default async function annotatePlaces({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve(PLACE_INDEX_MODULE) as Service

  const all = await service.listPlaces(
    {},
    { take: 200000, select: ["id", "name_en", "name_ar", "kind", "context", "search", "lat", "lng"] }
  )

  const areas = all.filter((p) => AREA_KINDS.has(p.kind))

  if (!areas.length) {
    logger.warn("places: no districts in the index, so nothing can be located — run import-places first")
    return
  }

  let written = 0
  let unchanged = 0
  let tooFar = 0

  for (const place of all) {
    // A district is not "in" itself, and naming a city after its own
    // neighbourhood reads as a mistake. Its search text is still checked
    // below, because that is about the words, not the district.
    const area = AREA_KINDS.has(place.kind) ? null : closest(place, areas)

    // Beyond 12 km there is no district worth claiming: the empty desert
    // between towns would otherwise be labelled with whatever is least far.
    const context = area && area.km <= 12 ? area.area.name_en : place.context
    if (!AREA_KINDS.has(place.kind) && (!area || area.km > 12)) tooFar++

    /**
     * The search text carries the district too.
     *
     * Someone typing "al meera wakra" is naming a shop and a place in one
     * breath, and the place is only in `context` — so without this the query
     * cannot match however the words are split, and the customer is sent to
     * WhatsApp for a destination we can price perfectly well.
     */
    const search = searchText({ name_en: place.name_en, name_ar: place.name_ar, context })

    if (place.context === context && place.search === search) {
      unchanged++
      continue
    }

    await service
      .updatePlaces({ id: place.id, context, search })
      .then(() => {
        written++
      })
      .catch((e) => logger.warn(`places: ${(e as Error).message.slice(0, 80)}`))
  }

  logger.info(
    `places: wrote ${written} (${unchanged} already right, ${tooFar} with no district within 12 km), ` +
      `against ${areas.length} districts`
  )
}

function closest(place: Row, areas: Row[]): { area: Row; km: number } | null {
  let best: { area: Row; km: number } | null = null

  for (const area of areas) {
    // A district beats a city at the same distance: "Al Sadd" locates someone
    // better than "Doha" does.
    const km =
      haversineKm({ lat: place.lat, lng: place.lng }, { lat: area.lat, lng: area.lng }) +
      (area.kind === "city" ? 3 : 0)
    if (!best || km < best.km) best = { area, km }
  }

  return best
}
