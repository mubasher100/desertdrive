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
  /**
   * The district shown under the name. Absent on a place straight from
   * Overpass — annotate-places works it out afterwards — and present in the
   * committed snapshot, so a fresh database has readable subtitles from its
   * first search rather than after the first weekly job.
   */
  context?: string | null
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
 * As broad as OpenStreetMap goes, on purpose. The first version took only
 * districts, hotels, campuses, malls and hospitals — 835 rows — and a customer
 * naming their restaurant, their gym or their child's school found nothing.
 * Indexing everything named costs the same weekly request.
 *
 * This is what replaces a paid autocomplete. Google's database is larger, but
 * it needs a key and bills per keystroke-session forever; this bills nothing,
 * and anything neither source knows is still reachable by tapping the map.
 *
 * ⚠️ **Streets are deliberately excluded.** Qatari residential streets are
 * numbered, and "Street 940" exists in a dozen different districts as dozens
 * of separate OSM ways. Offering them in a dropdown means a customer picking
 * the wrong one and being quoted the wrong district's fare, silently — and
 * de-duplicating by name would make that certain rather than likely. A street
 * address is what the map pin is for.
 *
 * All of it goes in ONE query per box. Asking separately per kind meant 64
 * requests for a country this size, which earns a 429 from a shared service
 * and deserves to — the kind is read back off the tags instead.
 */
export const PLACE_SELECTORS = [
  'nwr["place"~"^(city|town|suburb|neighbourhood|quarter|village|island|islet)$"]["name"]',
  'nwr["tourism"]["name"]',
  'nwr["amenity"]["name"]',
  'nwr["shop"]["name"]',
  'nwr["office"]["name"]',
  'nwr["leisure"]["name"]',
  'nwr["healthcare"]["name"]',
  'nwr["craft"]["name"]',
  'nwr["historic"]["name"]',
  'nwr["man_made"~"^(tower|lighthouse|water_tower|pier|bridge|observatory)$"]["name"]',
  'nwr["building"~"^(office|commercial|retail|apartments|hotel|hospital|university|school|mosque|public|civic|stadium|tower)$"]["name"]',
  'nwr["public_transport"="station"]["name"]',
  'nwr["railway"="station"]["name"]',
  'nwr["landuse"~"^(residential|commercial|retail|industrial)$"]["name"]',
  'nwr["natural"~"^(beach|bay|peninsula)$"]["name"]',
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
 *
 * A city or a town is kept apart from a district because it is what people
 * type first — "Lusail", "Al Wakrah" — and an area that large should not be
 * ranked beneath a hotel that happens to share a word with it.
 */
export function kindOf(tags: Record<string, string>): string | null {
  if (tags.place === "city" || tags.place === "town") return "city"
  if (tags.place === "island" || tags.place === "islet") return "island"
  if (tags.place) return "district"
  if (tags.aeroway === "aerodrome") return "airport"
  if (tags.amenity === "university" || tags.amenity === "college" || tags.amenity === "school")
    return "campus"
  if (tags.amenity === "hospital" || tags.amenity === "clinic" || tags.amenity === "doctors")
    return "hospital"
  if (tags.shop === "mall" || tags.shop === "department_store") return "mall"
  if (tags.tourism === "hotel" || tags.tourism === "resort" || tags.tourism === "guest_house" || tags.tourism === "hostel" || tags.tourism === "apartment")
    return "hotel"
  if (tags.tourism === "attraction" || tags.tourism === "museum" || tags.tourism === "theme_park" || tags.tourism === "zoo")
    return "landmark"
  if (tags.amenity === "place_of_worship") return "worship"
  if (tags.amenity === "restaurant" || tags.amenity === "cafe" || tags.amenity === "fast_food")
    return "food"
  if (tags.healthcare) return "hospital"
  if (tags.historic) return "landmark"
  if (tags.public_transport === "station" || tags.railway === "station") return "station"
  if (tags.leisure === "park" || tags.leisure === "garden" || tags.leisure === "beach_resort")
    return "park"
  if (tags.natural) return "park"
  if (tags.leisure) return "sport"
  if (tags.shop) return "shop"
  if (tags.office) return "office"
  if (tags.craft) return "office"
  if (tags.amenity) return "amenity"
  if (tags.tourism) return "landmark"
  if (tags.man_made) return "landmark"
  if (tags.landuse === "residential") return "compound"
  // A named building is a tower or a block people give as their address.
  if (tags.building) return "building"
  if (tags.landuse) return "compound"
  return null
}

/**
 * Qatar in boxes small enough for a loaded server to answer.
 *
 * Doha is split finely because that is where the density is; the rest of the
 * country is a handful of sparse squares.
 */
export const QATAR_BOXES: Array<[number, number, number, number]> = [
  // Greater Doha, quartered again: with every named feature in the query, the
  // old boxes were large enough that a loaded Overpass answered 504 to all of
  // them. Sixteen small queries get served where four big ones do not.
  [25.15, 51.40, 25.2250, 51.49],
  [25.15, 51.49, 25.2250, 51.58],
  [25.2250, 51.40, 25.30, 51.49],
  [25.2250, 51.49, 25.30, 51.58],
  [25.30, 51.40, 25.3750, 51.49],
  [25.30, 51.49, 25.3750, 51.58],
  [25.3750, 51.40, 25.45, 51.49],
  [25.3750, 51.49, 25.45, 51.58],
  [25.15, 51.25, 25.2250, 51.325],
  [25.15, 51.325, 25.2250, 51.40],
  [25.2250, 51.25, 25.30, 51.325],
  [25.2250, 51.325, 25.30, 51.40],
  [25.30, 51.25, 25.3750, 51.325],
  [25.30, 51.325, 25.3750, 51.40],
  [25.3750, 51.25, 25.45, 51.325],
  [25.3750, 51.325, 25.45, 51.40],
  // Lusail and the north-east coast.
  [25.45, 51.30, 25.55, 51.45],
  [25.45, 51.45, 25.55, 51.60],
  [25.55, 51.30, 25.65, 51.45],
  [25.55, 51.45, 25.65, 51.60],
  // Al Wakrah, Mesaieed and the south.
  [24.90, 51.15, 25.15, 51.45],
  [24.90, 51.45, 25.15, 51.70],
  // The north, and the sparse west and far south.
  [25.65, 51.00, 26.00, 51.70],
  [26.00, 51.00, 26.30, 51.70],
  [24.40, 50.70, 24.90, 51.20],
  [24.40, 51.20, 24.90, 51.70],
  [25.15, 50.70, 25.65, 51.25],
]

/** How this row is ranked against others with a similar name. */
const KIND_RANK: Record<string, number> = {
  city: 0,
  district: 1,
  airport: 2,
  campus: 3,
  mall: 4,
  island: 5,
  hotel: 6,
  hospital: 7,
  landmark: 8,
  compound: 9,
  worship: 10,
  park: 11,
  sport: 12,
  food: 13,
  shop: 14,
  office: 15,
  station: 16,
  building: 17,
  amenity: 18,
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

/**
 * Drops repeats of a place that OpenStreetMap holds more than once.
 *
 * A district is commonly mapped both as a point and as an area, and larger
 * ones as several areas — Nuaija appears three times, Al Bidda twice. They
 * are different OSM objects, so the index is right to keep them all; a
 * dropdown offering the same name three times is not.
 *
 * **The key is whatever the customer can actually tell apart**, which is the
 * name and the line under it — the district where there is one, the category
 * where there is not. Anything finer leaves the list showing what look like
 * exact duplicates; anything coarser throws away real choices.
 *
 * Both mistakes have been made here. Keying on name and kind alone was right
 * at 835 places and wrong at 8,300: Qatar has some thirty branches of the same
 * coffee chain, and collapsing them returned exactly one Starbucks — so a
 * customer standing outside a different one had no way to say so, and would
 * have been priced from a district they were nowhere near. Then adding the
 * district but keeping the kind let Villaggio Mall appear twice, because OSM
 * holds it both as a mall and as a retail area, and the kind it differs on is
 * the one thing the list does not show once a district is known.
 *
 * Call it AFTER ranking, so the copy that survives is the best-ranked one —
 * which is why the Villaggio row that stays is the mall and not the land.
 */
export function dedupePlaces<T extends { name_en: string; kind: string; context?: string | null }>(
  places: T[]
): T[] {
  const seen = new Set<string>()

  return places.filter((p) => {
    const subtitle = p.context ? `c:${p.context}` : `k:${p.kind}`
    const key = `${normaliseSearch(p.name_en)}|${subtitle}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
