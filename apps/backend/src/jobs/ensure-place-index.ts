import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLACE_INDEX_MODULE } from "../modules/place-index"
import { QATAR_PLACES } from "../data/qatar-places"
import { searchText } from "../lib/osm-places"

type Existing = {
  id: string
  osm_type: string
  osm_id: string
  context: string | null
  search: string
}

type Service = {
  listPlaces: (filters: object, config?: object) => Promise<Existing[]>
  createPlaces: (data: object[]) => Promise<unknown>
  updatePlaces: (data: object) => Promise<unknown>
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
    .listPlaces({}, { take: 200000, select: ["id", "osm_type", "osm_id", "context", "search"] })
    .catch(() => [] as Existing[])

  const have = new Map(existing.map((p) => [`${p.osm_type}:${p.osm_id}`, p]))

  /**
   * A row that was already here and is behind the snapshot.
   *
   * Adding the missing places is not enough on its own. Rows that predate a
   * snapshot keep whatever they had, and those are the oldest and most-used
   * entries in the index — the malls and campuses. Twice now that has shipped
   * a fix everywhere except where it mattered:
   *
   *   context  they showed a bare category while every newly added place
   *            showed its district.
   *   search   the searchable text gained the district, so a query naming a
   *            shop AND a place could match — but only for rows written after
   *            the change. The rest kept a name-only haystack and kept
   *            failing, which is the bug the change was meant to fix.
   *
   * Context is only ever FILLED, never overwritten: one worked out by
   * annotate-places or corrected by hand outranks a file. The search text is
   * derived, so it is simply rebuilt to match whichever context wins.
   */
  const stale = QATAR_PLACES.flatMap((p) => {
    const row = have.get(`${p.osm_type}:${p.osm_id}`)
    if (!row) return []

    const context = row.context ?? p.context ?? null
    const search = searchText({ name_en: p.name_en, name_ar: p.name_ar, context })
    if (row.context === context && row.search === search) return []

    return [{ id: row.id, context, search }]
  })

  const missing = QATAR_PLACES.filter((p) => !have.has(`${p.osm_type}:${p.osm_id}`))

  if (!missing.length && !stale.length) return

  logger.info(
    `places: index has ${existing.length} of the snapshot's ${QATAR_PLACES.length} — ` +
      `adding ${missing.length}, repairing ${stale.length}`
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

  for (const row of stale) {
    await service.updatePlaces(row).catch((e) => logger.warn(`places: ${(e as Error).message.slice(0, 100)}`))
  }

  logger.info(`places: index topped up to the snapshot`)
}

export const config = {
  name: "ensure-place-index",
  // Hourly. The work happens once, after a deploy that ships a bigger
  // snapshot; every other run is a single read that finds nothing to do.
  schedule: "17 * * * *",
}
