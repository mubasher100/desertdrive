import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLACE_INDEX_MODULE } from "../../../modules/place-index"
import { dedupePlaces, normaliseSearch, rankPlaces, searchTokens } from "../../../lib/osm-places"

type PlaceRow = {
  id: string
  name_en: string
  name_ar: string | null
  kind: string
  context: string | null
  lat: number
  lng: number
  search: string
}

type Service = { listPlaces: (filters: object, config?: object) => Promise<PlaceRow[]> }

/**
 * GET /store/places?q=udst
 *
 * Autocomplete over our own copy of Qatar's places: districts, hotels,
 * campuses, malls, hospitals, named compounds. No third-party call, nothing
 * billed per keystroke, and it answers when a paid service would be rate
 * limiting us.
 *
 * It returns coordinates and never a price. The priced area containing the
 * point — or the distance band — decides the fare, server-side, exactly as
 * for every other destination.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const raw = String(req.query.q ?? "").trim()
  const q = normaliseSearch(raw)

  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600")

  // Two characters is where the result set stops being the whole country.
  if (q.length < 2) {
    res.json({ places: [] })
    return
  }

  const service = req.scope.resolve(PLACE_INDEX_MODULE) as Service

  const select = ["id", "name_en", "name_ar", "kind", "context", "lat", "lng", "search"]

  /**
   * Two passes, not one.
   *
   * With a few hundred rows, "find anything containing the query, take 80,
   * then rank" was fine. With thousands it is not: "al" matches most of
   * Qatar, the database returns an arbitrary 80 of them, and ranking can only
   * sort the arbitrary 80 — the place the customer wanted may never have been
   * in the list. So ask twice: names that START with what was typed, which is
   * what a person means nine times out of ten, and then names that merely
   * contain it to fill the rest.
   */
  const empty: PlaceRow[] = []
  const tokens = searchTokens(raw)
  const longest = [...tokens].sort((a, b) => b.length - a.length)[0] ?? q

  /**
   * Three passes, widening.
   *
   * People type a name and a place together — "al meera wakra south" — and one
   * `LIKE '%whole phrase%'` finds nothing, because no row contains that string:
   * the name is in one column and the district in another. Reported from a
   * phone, and the customer's only option was WhatsApp.
   *
   *   prefix  what was typed, from the start of a name. The common case.
   *   every   every word present. Precise, and what "al meera wakra" wants.
   *   loose   the longest word alone, so an over-specific query degrades to
   *           something useful instead of an empty list.
   *
   * Ranking sorts across all three by how many words each row matched, so
   * precise beats loose without either needing to win in SQL.
   */
  const [prefix, every, loose] = await Promise.all([
    service.listPlaces({ search: { $like: `${q}%` } }, { take: 40, select }).catch(() => empty),
    tokens.length > 1
      ? service
          .listPlaces(
            { $and: tokens.map((t) => ({ search: { $like: `%${t}%` } })) },
            { take: 60, select }
          )
          .catch(() => empty)
      : Promise.resolve(empty),
    service.listPlaces({ search: { $like: `%${longest}%` } }, { take: 60, select }).catch(() => empty),
  ])

  const seen = new Set<string>()
  const matches = [...prefix, ...every, ...loose].filter((p) => {
    if (seen.has(p.id)) return false
    seen.add(p.id)
    return true
  })

  // Rank first, then drop repeats, so the copy that survives is the best one.
  const places = dedupePlaces(rankPlaces(matches, raw))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      name_en: p.name_en,
      name_ar: p.name_ar,
      kind: p.kind,
      context: p.context,
      lat: p.lat,
      lng: p.lng,
    }))

  res.json({ places })
}
