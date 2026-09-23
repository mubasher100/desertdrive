import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLACE_INDEX_MODULE } from "../../../modules/place-index"
import { dedupePlaces, normaliseSearch, rankPlaces } from "../../../lib/osm-places"

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

  const matches = await service
    .listPlaces(
      { search: { $like: `%${q}%` } },
      // Over-fetch, then rank: the database can find the matches but it cannot
      // know that a district beats a hotel of the same name.
      { take: 80, select: ["id", "name_en", "name_ar", "kind", "context", "lat", "lng", "search"] }
    )
    .catch(() => [])

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
