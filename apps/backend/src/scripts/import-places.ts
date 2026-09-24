import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { PLACE_INDEX_MODULE } from "../modules/place-index"
import { QATAR_PLACES } from "../data/qatar-places"
import {
  boxQuery,
  OVERPASS_MIRRORS,
  OVERPASS_UA,
  QATAR_BOXES,
  searchText,
  toPlace,
  type OsmPlace,
} from "../lib/osm-places"

type Service = {
  listPlaces: (
    filters: object,
    config?: object
  ) => Promise<Array<OsmPlace & { id: string; context: string | null }>>
  createPlaces: (data: object[]) => Promise<unknown>
  updatePlaces: (data: object) => Promise<unknown>
  deletePlaces: (ids: string[]) => Promise<unknown>
}

/**
 * Rebuilds the searchable place index from OpenStreetMap.
 *
 *   npx medusa exec ./src/scripts/import-places.ts
 *
 * Run weekly by the refresh-places job, and by hand for the first load. It is
 * idempotent: places are matched on their OSM identity, so a re-run updates
 * names and positions rather than duplicating them.
 *
 * Failure is survivable by design, which matters because the free Overpass
 * servers are down or rate limiting as often as not. A committed snapshot of
 * Qatar's places is the floor: it is loaded first, then whatever Overpass
 * returns is layered on top. So a deploy has a working search immediately,
 * a weekly refresh improves it, and a refresh that fails changes nothing.
 */
export default async function importPlaces({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const service = container.resolve(PLACE_INDEX_MODULE) as Service

  /**
   * The snapshot goes in first and is written before anything is fetched.
   *
   * Overpass can take ten minutes or fail outright, and a fresh deploy must
   * not have an empty search box for that long — let alone until the weekly
   * job next runs. So: commit the floor, then improve on it.
   */
  const written = await upsert(service, QATAR_PLACES, logger)
  logger.info(`places: snapshot committed — ${written.added} added, ${written.updated} updated`)

  // PLACES_SNAPSHOT_ONLY=1 stops here. Overpass takes ten minutes on a good
  // day and can spend an hour timing out on a bad one, and loading a fresh
  // database — or pushing a corrected snapshot to one — needs neither.
  if (process.env.PLACES_SNAPSHOT_ONLY === "1") {
    logger.info("places: PLACES_SNAPSHOT_ONLY set — skipping the Overpass refresh")
    return
  }

  const found = new Map<string, OsmPlace>()
  let failures = 0

  /**
   * PLACES_BOXES=11,16,26 fetches only those boxes, 1-based.
   *
   * Overpass fails a box or two on a bad day — three of twenty-seven on the
   * first full run — and re-running the whole country to fill two gaps is
   * forty minutes of somebody else's free server for nothing.
   */
  const only = (process.env.PLACES_BOXES ?? "")
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= QATAR_BOXES.length)

  const boxes = only.length
    ? only.map((n) => [n - 1, QATAR_BOXES[n - 1]] as const)
    : QATAR_BOXES.map((box, i) => [i, box] as const)

  if (only.length) logger.info(`places: fetching only box(es) ${only.join(", ")}`)

  for (const [index, box] of boxes) {
    const elements = await fetchWithRetry(boxQuery(box), logger)

    if (elements === null) {
      failures++
      continue
    }

    for (const el of elements) {
      const place = toPlace(el)
      if (place) {
        found.set(`${place.osm_type}:${place.osm_id}`, place)
      }
    }

    logger.info(`places: box ${index + 1}/${QATAR_BOXES.length} done, ${found.size} unique so far`)

    // A courtesy pause between boxes. This is somebody else's free server and
    // the whole country is eight requests; there is no hurry.
    if (boxes[boxes.length - 1][0] !== index) {
      await new Promise((r) => setTimeout(r, 4000))
    }
  }

  if (!found.size) {
    logger.warn(
      `places: Overpass returned nothing (${failures} box(es) failed). The snapshot is in place; try again later.`
    )
    return
  }

  const live = await upsert(service, [...found.values()], logger)

  logger.info(
    `places: ${found.size} fetched from Overpass — ${live.added} added, ${live.updated} updated` +
      (failures ? `, ${failures} box(es) failed and were skipped` : "")
  )
}

/**
 * Writes places, matching on their OSM identity so a re-run updates rather
 * than duplicates, and only touching rows whose details actually changed —
 * most weeks, almost none have.
 */
async function upsert(
  service: Service,
  places: OsmPlace[],
  logger: { warn: (m: string) => void }
): Promise<{ added: number; updated: number }> {
  if (!places.length) return { added: 0, updated: 0 }

  type Existing = OsmPlace & { id: string; context: string | null }
  const existing: Existing[] = await service.listPlaces({}, { take: 100000 }).catch(() => [] as Existing[])
  const byKey = new Map<string, Existing>(existing.map((p) => [`${p.osm_type}:${p.osm_id}`, p]))

  const toCreate: object[] = []
  let updated = 0

  for (const place of places) {
    const current = byKey.get(`${place.osm_type}:${place.osm_id}`)

    const row = {
      ...place,
      // Context is filled by annotate-places, which runs after this and needs
      // the whole index to work out which district a place sits in. Carry the
      // existing value through rather than writing null over it: a refresh
      // that nudges a coordinate must not blank every subtitle in the list.
      context: current?.context ?? place.context ?? null,
      search: searchText(place),
    }

    if (!current) {
      toCreate.push(row)
      continue
    }

    // `kind` is compared too: reclassifying Lusail from a district to a city
    // changes nothing else about the row, so leaving it out would mean the
    // change never reached a database that already had it.
    //
    // Coordinates get a tolerance rather than an equality test. The snapshot
    // is stored rounded and Overpass answers at full precision, so an exact
    // comparison rewrites every row every week over a difference of
    // centimetres. 1e-5 degrees is about a metre — well under the accuracy a
    // pickup pin needs, and far above the rounding.
    if (
      current.name_en !== row.name_en ||
      current.name_ar !== row.name_ar ||
      current.kind !== row.kind ||
      Math.abs(current.lat - row.lat) > 1e-5 ||
      Math.abs(current.lng - row.lng) > 1e-5
    ) {
      await service.updatePlaces({ id: current.id, ...row }).catch((e) => logger.warn(`places: ${(e as Error).message.slice(0, 60)}`))
      updated++
    }
  }

  // Batched: a few thousand inserts one at a time is a few thousand round trips.
  for (let i = 0; i < toCreate.length; i += 500) {
    await service.createPlaces(toCreate.slice(i, i + 500))
  }

  return { added: toCreate.length, updated }
}

/** One box, tried across mirrors with backoff. Returns null when every attempt failed. */
async function fetchWithRetry(
  query: string,
  logger: { warn: (m: string) => void }
): Promise<Array<Record<string, unknown>> | null> {
  for (let attempt = 0; attempt < OVERPASS_MIRRORS.length * 2; attempt++) {
    const url = OVERPASS_MIRRORS[attempt % OVERPASS_MIRRORS.length]

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": OVERPASS_UA },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(120_000),
      })

      // A loaded Overpass answers 200 with an HTML error page, so the content
      // type is checked rather than the status alone.
      const type = res.headers.get("content-type") ?? ""
      if (!res.ok || !type.includes("json")) {
        throw new Error(`${res.status} ${type.slice(0, 40)}`)
      }

      const body = (await res.json()) as { elements?: Array<Record<string, unknown>> }
      return body.elements ?? []
    } catch (e) {
      // 429 is "you are asking too fast", and answering it quickly makes it
      // worse. Everything else is a loaded server, which recovers sooner.
      const rateLimited = (e as Error).message.startsWith("429")
      const wait = rateLimited ? 60_000 : 5000 * (attempt + 1)
      logger.warn(`places: attempt ${attempt + 1} failed (${(e as Error).message.slice(0, 60)}), waiting ${wait / 1000}s`)
      await new Promise((r) => setTimeout(r, wait))
    }
  }

  return null
}

