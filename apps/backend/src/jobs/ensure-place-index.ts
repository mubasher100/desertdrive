import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLACE_INDEX_MODULE } from "../modules/place-index"
import { QATAR_PLACES } from "../data/qatar-places"
import { searchText } from "../lib/osm-places"

type Service = {
  listPlaces: (filters: object, config?: object) => Promise<Array<{ osm_type: string; osm_id: string }>>
  createPlaces: (data: object[]) => Promise<unknown>
}

/**
 * Keeps the search index from ever being emptier than the snapshot we ship.
 *
 * The invariant: whatever is in `src/data/qatar-places.ts` is in the database.
 * A deploy carries the snapshot into the image but nothing writes it — the
 * import is a weekly job and a manual command — so a database that predates
 * a snapshot update keeps serving the old, smaller index until Sunday. That
 * is how production sat on 835 places while the repo held 8,341.
 *
 * It also covers the cases nobody plans for: a restored backup, a new
 * environment, a staging database someone points at the same code.
 *
 * Cheap when there is nothing to do, which is almost always: one count-shaped
 * read, then nothing. It only ever ADDS places missing by OSM identity, so it
 * cannot undo a weekly refresh, overwrite a correction, or duplicate a row.
 */
export default async function ensurePlaceIndex(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve(PLACE_INDEX_MODULE) as Service

  const existing = await service
    .listPlaces({}, { take: 200000, select: ["osm_type", "osm_id"] })
    .catch(() => [] as Array<{ osm_type: string; osm_id: string }>)

  if (existing.length >= QATAR_PLACES.length) return

  const have = new Set(existing.map((p) => `${p.osm_type}:${p.osm_id}`))
  const missing = QATAR_PLACES.filter((p) => !have.has(`${p.osm_type}:${p.osm_id}`))

  if (!missing.length) return

  logger.info(
    `places: index has ${existing.length} of the snapshot's ${QATAR_PLACES.length} — adding ${missing.length}`
  )

  // Batched: several thousand inserts one at a time is several thousand round
  // trips to a database on the other side of a pooler.
  for (let i = 0; i < missing.length; i += 500) {
    await service
      .createPlaces(
        missing.slice(i, i + 500).map((p) => ({
          ...p,
          context: p.context ?? null,
          search: searchText(p),
        }))
      )
      .catch((e) => logger.warn(`places: ${(e as Error).message.slice(0, 100)}`))
  }

  logger.info(`places: index topped up to the snapshot`)
}

export const config = {
  name: "ensure-place-index",
  // Hourly. The work happens once, after a deploy that ships a bigger
  // snapshot; every other run is a single read that finds nothing to do.
  schedule: "17 * * * *",
}
