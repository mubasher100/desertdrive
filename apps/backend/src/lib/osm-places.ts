/**
 * Pulling Qatar's places out of OpenStreetMap.
 *
 * Kept separate from the import script so the parsing and ranking rules are
 * unit-testable without a network.
 *
 * ⚠️ The public Overpass servers shed load by timing out or answering with an
 * HTML error page rather than JSON — during one afternoon's work they refused
 * every geometry query and answered every count. So: small boxes, several
 * mirrors, retries with backoff, and partial results kept. A weekly job that
 * fails is not an outage, because the previous import is still in the table.
 */

export type OsmPlace = {
  osm_type: string
  osm_id: string
  name_en: string
  name_ar: string | null
  kind: string
  lat: number
  lng: number
}

/** Mirrors, tried in turn. The main instance is the most loaded, so it is not first. */
export const OVERPASS_MIRRORS = [
  // Ordered by what actually connects from Node. overpass.private.coffee
  // answers curl but times out on connect from undici, which is a difference
  // worth remembering rather than rediscovering.
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
]

/** Identifies us to a free service that asks callers to say who they are. */
export const OVERPASS_UA = "DesertDrive/1.0 (airport transfers; bookings@desertdriverental.com)"

/**
 * What a customer might type, roughly in the order they would mean it.
 *
 * Deliberately not "everything": a shop or a bus stop is noise in a list of
 * pickup points, and every extra tag is more of a free service's time.
 *
 * All of it goes in ONE query per box. Asking separately per kind meant 64
 * requests for a country this size, which earns a 429 from a shared service
 * and deserves to — the kind is read back off the tags instead.
 */
export const PLACE_SELECTORS = [
  'nwr["place"~"^(suburb|neighbourhood|quarter|town|village)$"]["name"]',
  'nwr["tourism"~"^(hotel|attraction|museum)$"]["name"]',
  'nwr["amenity"~"^(university|college|hospital)$"]["name"]',
  'nwr["shop"="mall"]["name"]',
  'nwr["landuse"="residential"]["name"]',
  'nwr["aeroway"="aerodrome"]["name"]',
]

/** One Overpass query covering every kind inside a box. */
export function boxQuery(box: [number, number, number, number]): string {
  const [s, w, n, e] = box
  const union = PLACE_SELECTORS.map((sel) => `${sel}(${s},${w},${n},${e});`).join("")
  return `[out:json][timeout:120];(${union});out center tags;`
}

/**
 * What sort of place this is, from its tags.
 *
 * Read from the feature rather than from which query returned it, now that
 * one query returns them all. Order matters: a university with a hotel on
 * campus is a university.
 */
export function kindOf(tags: Record<string, string>): string | null {
  if (tags.place) return "district"
  if (tags.aeroway === "aerodrome") return "airport"
  if (tags.amenity === "university" || tags.amenity === "college") return "campus"
  if (tags.amenity === "hospital") return "hospital"
  if (tags.shop === "mall") return "mall"
  if (tags.tourism === "hotel") return "hotel"
  if (tags.tourism === "attraction" || tags.tourism === "museum") return "landmark"
  if (tags.landuse === "residential") return "compound"
  return null
}

/**
 * Qatar in boxes small enough for a loaded server to answer.
 *
 * Doha is split finely because that is where the density is; the rest of the
 * country is a handful of sparse squares.
 */
export const QATAR_BOXES: Array<[number, number, number, number]> = [
  [25.15, 51.40, 25.30, 51.58],
  [25.30, 51.40, 25.45, 51.58],
  [25.15, 51.25, 25.30, 51.40],
  [25.30, 51.25, 25.45, 51.40],
  [25.45, 51.30, 25.65, 51.60],
  [24.90, 51.15, 25.15, 51.70],
  [25.65, 51.00, 26.30, 51.70],
  [24.40, 50.70, 24.90, 51.70],
]

/** How this row is ranked against others with a similar name. */
const KIND_RANK: Record<string, number> = {
  district: 0,
  airport: 1,
  campus: 2,
  mall: 3,
  hotel: 4,
  hospital: 5,
  landmark: 6,
  compound: 7,
}

export function kindRank(kind: string): number {
  return KIND_RANK[kind] ?? 9
}

type OverpassElement = {
  type?: string
  id?: number | string
  lat?: number
  lon?: number
  center?: { lat?: number; lon?: number }
  tags?: Record<string, string>
}

/**
 * Turns an Overpass element into a row, or null if it is unusable.
 *
 * A way or relation has no coordinates of its own — `out center` adds them —
 * and anything without a name or a point is not searchable, so it is dropped
 * rather than stored half-formed.
 */
export function toPlace(el: OverpassElement, kind?: string): OsmPlace | null {
  const tags = el.tags ?? {}
  const name = tags["name:en"] ?? tags.name
  if (!name) return null

  const resolved = kind ?? kindOf(tags)
  if (!resolved) return null

  const lat = el.lat ?? el.center?.lat
  const lng = el.lon ?? el.center?.lon
  if (typeof lat !== "number" || typeof lng !== "number") return null

  return {
    osm_type: String(el.type ?? "node"),
    osm_id: String(el.id ?? ""),
    name_en: name.trim().slice(0, 160),
    name_ar: (tags["name:ar"] ?? "").trim().slice(0, 160) || null,
    kind: resolved,
    lat,
    lng,
  }
}

/**
 * The haystack a query is matched against.
 *
 * Both names in one string, lowercased, with Arabic orthography flattened —
 * alef forms, ya/alef maqsura, ta marbuta and the diacritics people omit —
 * so "الدوحه" finds "الدوحة".
 */
export function searchText(place: Pick<OsmPlace, "name_en" | "name_ar">): string {
  return normaliseSearch([place.name_en, place.name_ar].filter(Boolean).join(" "))
}

export function normaliseSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim()
}

/**
 * Orders matches the way a person expects.
 *
 * A name that starts with what was typed beats one that merely contains it,
 * a district beats a hotel of the same name, and a short name beats a long
 * one — "Lusail" before "Lusail Boulevard Retail Units".
 */
export function rankPlaces<T extends { name_en: string; kind: string; search: string }>(
  places: T[],
  query: string
): T[] {
  const q = normaliseSearch(query)

  return [...places].sort((a, b) => {
    const aStarts = a.search.startsWith(q) ? 0 : 1
    const bStarts = b.search.startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts

    const aWord = new RegExp(`(^| )${escapeRegExp(q)}`).test(a.search) ? 0 : 1
    const bWord = new RegExp(`(^| )${escapeRegExp(q)}`).test(b.search) ? 0 : 1
    if (aWord !== bWord) return aWord - bWord

    const rank = kindRank(a.kind) - kindRank(b.kind)
    if (rank !== 0) return rank

    return a.name_en.length - b.name_en.length
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
