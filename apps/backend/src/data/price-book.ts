/**
 * The owner's price list of 29 Sept 2026, as data.
 *
 * ⚠️ THIS IS A STARTING POINT, NOT THE SOURCE OF TRUTH. It is applied to a
 * database ONCE per `PRICE_BOOK_VERSION` (see jobs/apply-price-book.ts), and
 * from then on the admin owns every price: the owner edits a fare there and it
 * is live within the cache window, exactly as before. Re-applying the book on
 * every deploy would silently undo those edits, which is the thing CLAUDE.md
 * says never to build. To publish a NEW list, edit this file AND bump the
 * version — both, or nothing happens.
 *
 * ── Whole US dollars ────────────────────────────────────────────────────────
 * The owner priced in riyals and asked for prices that are whole numbers in
 * dollars (29 Sept 2026). Every riyal figure is converted at the peg and
 * rounded UP to the next dollar — up, so no fare is ever below what the owner
 * set. The card is then charged the exact riyal equivalent: $17 is 61.88 QAR.
 * Doubled fares, returns and $5 extras all stay whole.
 *
 * ── Where the prices come from ──────────────────────────────────────────────
 * Named areas are the owner's. Everywhere else takes the pricing of the
 * nearest named area at a similar distance, per the owner's instruction:
 *
 *   ring            km   like                     why
 *   band A        ≤18.5  West Bay                 the city ring is mostly 8–15 km,
 *                                                  and West Bay sits in the middle
 *   band B        ≤40    North Lusail             Lusail is the nearest priced
 *                                                  place at that distance
 *   band C        ≤75    between N. Lusail & Salwa  no named place in this ring
 *                                                  (Al Khor, Ras Laffan); midpoint
 *   band D        >75    Hilton Salwa             Salwa and Ruwais are both here
 *
 * Plus two areas the owner did not name, priced by the nearest one that was:
 *   Lusail Marina  — between the Pearl and North Lusail, joined to the Pearl
 *   Aspire Zone    — The Torch, Villaggio; 16.6 km, between the Pearl (12.9)
 *                    and Education City (17.3); priced like the Pearl
 *
 * Luxury classes: the owner's Downtown figures (S-Class 650, V-Class 750 QAR)
 * plus a per-area uplift — West Bay +100, Pearl +200, North Lusail +300,
 * Education City +400, Salwa/Ruwais/Sealine +500.
 */

export const PRICE_BOOK_VERSION = "2026-09-29"

/** The Qatar Central Bank peg. A constant, not a market rate. */
export const QAR_PER_USD = 3.64

export type VehicleClass = "sedan" | "suv" | "large-van" | "luxury-sedan" | "luxury-van"

/** Prices in whole US dollars. */
export type Tier = Record<VehicleClass, number>

/** The owner's riyal figure, rounded up to the next whole dollar. */
export function usdFromOwnerQar(qar: number): number {
  // The epsilon keeps a figure that is already a whole dollar (182 QAR = $50)
  // from being pushed up a dollar by floating-point noise.
  return Math.ceil(qar / QAR_PER_USD - 1e-9)
}

/** What the card is charged for a dollar price: riyals to the fils. */
export function qarFromUsd(usd: number): number {
  return Math.round(usd * QAR_PER_USD * 100) / 100
}

/** Builds a tier from the owner's riyal figures. */
function tier(qar: Record<VehicleClass, number>): Tier {
  return Object.fromEntries(
    Object.entries(qar).map(([k, v]) => [k, usdFromOwnerQar(v)])
  ) as Tier
}

const LUX_DOWNTOWN = { "luxury-sedan": 650, "luxury-van": 750 }
const lux = (up: number) => ({
  "luxury-sedan": LUX_DOWNTOWN["luxury-sedan"] + up,
  "luxury-van": LUX_DOWNTOWN["luxury-van"] + up,
})

/** The owner's list, in riyals exactly as given. */
export const TIERS = {
  downtown: tier({ sedan: 60, suv: 80, "large-van": 150, ...lux(0) }),
  westBay: tier({ sedan: 80, suv: 100, "large-van": 180, ...lux(100) }),
  pearl: tier({ sedan: 100, suv: 150, "large-van": 220, ...lux(200) }),
  northLusail: tier({ sedan: 150, suv: 220, "large-van": 280, ...lux(300) }),
  educationCity: tier({ sedan: 150, suv: 220, "large-van": 280, ...lux(400) }),
  resorts: tier({ sedan: 350, suv: 500, "large-van": 750, ...lux(500) }),
  /** Not the owner's: the midpoint of North Lusail and the resorts, for 40–75 km. */
  midRing: tier({ sedan: 250, suv: 360, "large-van": 515, "luxury-sedan": 1050, "luxury-van": 1150 }),
} satisfies Record<string, Tier>

/** Distance bands as the fallback behind the named areas. */
export const BAND_TIERS: Record<"A" | "B" | "C" | "D", Tier> = {
  A: TIERS.westBay,
  B: TIERS.northLusail,
  C: TIERS.midRing,
  D: TIERS.resorts,
}

type Point = { lat: number; lng: number }

export type BookZone = {
  code: string
  name_en: string
  name_ar: string
  /** Lower wins where areas touch. All below 20, so they beat anything drawn earlier. */
  rank: number
  tier: Tier
  polygon: Point[]
  /** A real place the outline must contain — checked by a unit test. */
  anchors: Array<{ name: string } & Point>
}

/** A rectangle, corners in order. Areas here are a few km across, where that is enough. */
const box = (south: number, west: number, north: number, east: number): Point[] => [
  { lat: south, lng: west },
  { lat: south, lng: east },
  { lat: north, lng: east },
  { lat: north, lng: west },
]

/** A 16-sided ring of `km` radius — for a resort that is one point on a coast. */
const around = (lat: number, lng: number, km: number): Point[] =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * 2 * Math.PI
    return {
      lat: Math.round((lat + (km / 111.32) * Math.sin(a)) * 1e5) / 1e5,
      lng: Math.round((lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a)) * 1e5) / 1e5,
    }
  })

/**
 * The named areas. Outlines follow the hotel districts, with coordinates taken
 * from the place index rather than guessed; every one names hotels it must
 * contain, and a unit test holds it to that.
 *
 * Arabic names want a native reviewer, like the rest of the Arabic copy.
 */
export const ZONES: BookZone[] = [
  {
    code: "PEARL",
    name_en: "The Pearl",
    name_ar: "اللؤلؤة",
    rank: 1,
    tier: TIERS.pearl,
    // The island and Gewan, east of the lagoon channel at 51.536.
    polygon: box(25.355, 51.536, 25.392, 51.572),
    anchors: [
      { name: "Marsa Malaz Kempinski", lat: 25.3761, lng: 51.5497 },
      { name: "Porto Arabia", lat: 25.366, lng: 51.5401 },
    ],
  },
  {
    code: "LUSAIL-MARINA",
    name_en: "Lusail Marina",
    name_ar: "مارينا لوسيل",
    rank: 2,
    tier: TIERS.pearl,
    // The southern tip of Lusail: Katara Towers (Fairmont, Raffles), the Marina towers.
    polygon: box(25.382, 51.505, 25.398, 51.545),
    anchors: [
      { name: "Fairmont Doha", lat: 25.3888, lng: 51.5315 },
      { name: "Raffles Doha", lat: 25.3901, lng: 51.5318 },
    ],
  },
  {
    code: "LUSAIL-NORTH",
    name_en: "North Lusail",
    name_ar: "شمال لوسيل",
    rank: 3,
    tier: TIERS.northLusail,
    // Place Vendôme and the Waldorf northwards: the stadium, Fox Hills, Qetaifan.
    polygon: box(25.398, 51.465, 25.475, 51.545),
    anchors: [
      { name: "Waldorf Astoria Lusail", lat: 25.4086, lng: 51.521 },
      { name: "Place Vendôme", lat: 25.4044, lng: 51.5205 },
      { name: "Lusail Stadium", lat: 25.4208, lng: 51.4904 },
      { name: "Qetaifan Island North", lat: 25.4315, lng: 51.5291 },
    ],
  },
  {
    code: "WESTBAY",
    name_en: "West Bay",
    name_ar: "الخليج الغربي",
    rank: 4,
    tier: TIERS.westBay,
    // Al Dafna and the towers north to Katara and the West Bay Lagoon — the
    // Ritz-Carlton sits on the lagoon side of the Pearl bridge. L-shaped: the
    // towers run out to the shore (the Four Seasons is at 51.539), but north
    // of 25.355 the edge pulls back to the lagoon channel, where the Pearl
    // begins.
    polygon: [
      { lat: 25.305, lng: 51.495 },
      { lat: 25.305, lng: 51.55 },
      { lat: 25.355, lng: 51.55 },
      { lat: 25.355, lng: 51.536 },
      { lat: 25.382, lng: 51.536 },
      { lat: 25.382, lng: 51.495 },
    ],
    anchors: [
      { name: "Four Seasons Doha", lat: 25.3244, lng: 51.5391 },
      { name: "W Doha", lat: 25.3288, lng: 51.5301 },
      { name: "Shangri-La", lat: 25.3245, lng: 51.5337 },
      { name: "InterContinental Doha Beach", lat: 25.3488, lng: 51.5294 },
      { name: "The St. Regis Doha", lat: 25.3503, lng: 51.528 },
      { name: "The Ritz-Carlton", lat: 25.3794, lng: 51.5318 },
      { name: "Katara", lat: 25.36, lng: 51.5247 },
    ],
  },
  {
    code: "EDUCATION-CITY",
    name_en: "Education City",
    name_ar: "المدينة التعليمية",
    rank: 5,
    tier: TIERS.educationCity,
    polygon: box(25.298, 51.405, 25.335, 51.458),
    anchors: [
      { name: "Education City Student Center", lat: 25.3146, lng: 51.4419 },
      { name: "Qatar Foundation HQ", lat: 25.3181, lng: 51.4364 },
    ],
  },
  {
    code: "ASPIRE",
    name_en: "Aspire Zone",
    name_ar: "أسباير زون",
    rank: 6,
    tier: TIERS.pearl,
    polygon: box(25.245, 51.425, 25.278, 51.46),
    anchors: [
      { name: "The Torch Doha", lat: 25.2623, lng: 51.4448 },
      { name: "Villaggio Mall", lat: 25.2595, lng: 51.443 },
    ],
  },
  {
    code: "DOWNTOWN",
    name_en: "Downtown Doha",
    name_ar: "وسط الدوحة",
    rank: 7,
    tier: TIERS.downtown,
    // Msheireb, Souq Waqif, the old town and Al Sadd, and everything between
    // there and the airport — Old Airport, Al Hilal, Najma. By the owner's
    // "nearest location" rule those are Downtown, not the dearer city ring.
    polygon: box(25.225, 51.49, 25.305, 51.6),
    anchors: [
      { name: "Mandarin Oriental", lat: 25.2862, lng: 51.5259 },
      { name: "Souq Waqif", lat: 25.2884, lng: 51.5328 },
      { name: "DoubleTree Old Town", lat: 25.2886, lng: 51.5444 },
      { name: "DoubleTree Al Sadd", lat: 25.276, lng: 51.4981 },
      { name: "DoubleTree Downtown", lat: 25.2714, lng: 51.5133 },
    ],
  },
  {
    code: "SEALINE",
    name_en: "Sealine",
    name_ar: "سيلين",
    rank: 8,
    tier: TIERS.resorts,
    polygon: around(24.8609, 51.5168, 5),
    anchors: [{ name: "Sealine Beach Resort", lat: 24.8609, lng: 51.5168 }],
  },
  {
    code: "SALWA",
    name_en: "Hilton Salwa",
    name_ar: "هيلتون سلوى",
    rank: 9,
    tier: TIERS.resorts,
    polygon: around(24.8516, 50.8592, 6),
    anchors: [{ name: "Hilton Salwa Beach Resort & Villas", lat: 24.8516, lng: 50.8592 }],
  },
  {
    code: "RUWAIS",
    name_en: "Al Ruwais",
    name_ar: "الرويس",
    rank: 10,
    tier: TIERS.resorts,
    polygon: around(26.1295, 51.2047, 6),
    anchors: [
      { name: "Al Ruwais", lat: 26.1295, lng: 51.2047 },
      { name: "Al Ruwais Port", lat: 26.1434, lng: 51.2056 },
    ],
  },
]
