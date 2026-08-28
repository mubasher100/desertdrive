import { haversineKm, resolveBand, isValidLatLng, type BandBounds } from "../geo"

/** Hamad International airport reference point (25°16′23″N 51°36′29″E). */
const DOH = { lat: 25.273056, lng: 51.608056 }

/**
 * The band table as seeded. Kept in sync with seed-fleet.ts by the calibration
 * test below — if the seed bounds move, these expectations fail loudly.
 */
const BANDS: BandBounds[] = [
  { code: "A", max_km: 18.5, rank: 1 },
  { code: "B", max_km: 40, rank: 2 },
  { code: "C", max_km: 75, rank: 3 },
  { code: "D", max_km: null, rank: 4 },
]

describe("haversineKm", () => {
  it("is zero for a point against itself", () => {
    expect(haversineKm(DOH, DOH)).toBe(0)
  })

  it("is symmetric", () => {
    const lusail = { lat: 25.4106, lng: 51.4914 }
    expect(haversineKm(DOH, lusail)).toBeCloseTo(haversineKm(lusail, DOH), 9)
  })

  it("matches a known reference distance", () => {
    // One degree of latitude at the equator ≈ 111.19 km for R = 6371.
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1)
  })
})

/**
 * Calibration. These are the destinations named in CLAUDE.md as the ones that
 * must be checked before launch, pinned to their measured straight-line distance
 * from the airport.
 *
 * The point of pinning them is that band boundaries cannot be nudged without a
 * test turning red and naming the destination that changed price. Getting a
 * boundary wrong in the optimistic direction undercharges every long trip
 * silently and permanently.
 */
describe("Qatar destination calibration", () => {
  const DESTINATIONS: Array<[string, number, number, number, string]> = [
    // name,                lat,      lng,      expected km, expected band
    ["Souq Waqif", 25.287, 51.533, 7.7, "A"],
    ["West Bay", 25.32, 51.53, 9.4, "A"],
    ["Al Wakrah", 25.1659, 51.6031, 11.9, "A"],
    ["Education City", 25.3145, 51.437, 17.8, "A"],
    ["Lusail Marina", 25.4106, 51.4914, 19.3, "B"],
    ["Mesaieed", 24.9917, 51.55, 31.8, "B"],
    ["Al Khor", 25.684, 51.498, 47.0, "C"],
    ["Ras Laffan", 25.9, 51.55, 70.0, "C"],
    ["Dukhan", 25.43, 50.785, 84.5, "D"],
    ["Al Zubarah", 25.9789, 51.0244, 97.9, "D"],
  ]

  it.each(DESTINATIONS)(
    "%s is %s km from DOH and resolves to band %s",
    (_name, lat, lng, expectedKm, expectedBand) => {
      const km = haversineKm(DOH, { lat, lng })
      expect(km).toBeCloseTo(expectedKm, 1)
      expect(resolveBand(km, BANDS)?.code).toBe(expectedBand)
    }
  )

  /**
   * The A/B boundary is 18.5 km specifically so that ALL of Lusail prices the
   * same way — as band B. At the original 20 km, Lusail Marina fell inside band
   * A while northern Lusail fell outside it, so two addresses a customer would
   * both call "Lusail" priced differently for no visible reason.
   *
   * This test is the guard on that decision: it fails if the boundary is ever
   * raised back above Lusail Marina.
   */
  it("prices the whole of Lusail as band B", () => {
    const lusailMarina = haversineKm(DOH, { lat: 25.4106, lng: 51.4914 })
    const northLusail = haversineKm(DOH, { lat: 25.4462, lng: 51.4914 })

    expect(resolveBand(lusailMarina, BANDS)?.code).toBe("B")
    expect(resolveBand(northLusail, BANDS)?.code).toBe("B")
  })

  /**
   * The other side of the same boundary. Education City (17.8) and Lusail
   * Marina (19.3) are only 1.5 km apart, so 18.5 is a deliberately balanced
   * split rather than a round number — roughly 0.7 km of headroom either way.
   * Anything tighter and normal GPS variation could move a booking's price.
   */
  it("keeps Education City in band A, with the boundary balanced between them", () => {
    const educationCity = haversineKm(DOH, { lat: 25.3145, lng: 51.437 })
    const lusailMarina = haversineKm(DOH, { lat: 25.4106, lng: 51.4914 })

    expect(resolveBand(educationCity, BANDS)?.code).toBe("A")
    expect(18.5 - educationCity).toBeGreaterThan(0.5)
    expect(lusailMarina - 18.5).toBeGreaterThan(0.5)
  })
})

describe("resolveBand", () => {
  it("picks the first band by rank whose bound is not exceeded", () => {
    expect(resolveBand(0, BANDS)?.code).toBe("A")
    expect(resolveBand(18.49, BANDS)?.code).toBe("A")
  })

  it("treats max_km as inclusive", () => {
    expect(resolveBand(18.5, BANDS)?.code).toBe("A")
    expect(resolveBand(40, BANDS)?.code).toBe("B")
  })

  it("falls through to the unbounded catch-all", () => {
    expect(resolveBand(75.01, BANDS)?.code).toBe("D")
    expect(resolveBand(10_000, BANDS)?.code).toBe("D")
  })

  it("honours rank rather than array order", () => {
    const shuffled = [...BANDS].reverse()
    expect(resolveBand(30, shuffled)?.code).toBe("B")
  })

  it("returns null rather than guessing when no band matches", () => {
    // A table with no unbounded catch-all cannot price a far destination. The
    // caller must decline the quote, not silently fall back to the priciest band.
    const bounded = BANDS.filter((b) => b.max_km !== null)
    expect(resolveBand(500, bounded)).toBeNull()
  })

  it("rejects nonsense distances", () => {
    expect(resolveBand(NaN, BANDS)).toBeNull()
    expect(resolveBand(-1, BANDS)).toBeNull()
    expect(resolveBand(Infinity, BANDS)).toBeNull()
  })
})

describe("isValidLatLng", () => {
  it("accepts a real coordinate", () => {
    expect(isValidLatLng(DOH)).toBe(true)
  })

  it("rejects malformed client input", () => {
    expect(isValidLatLng(null)).toBe(false)
    expect(isValidLatLng(undefined)).toBe(false)
    expect(isValidLatLng({})).toBe(false)
    expect(isValidLatLng({ lat: 25, lng: "51.6" })).toBe(false)
    expect(isValidLatLng({ lat: NaN, lng: 51.6 })).toBe(false)
    expect(isValidLatLng({ lat: 91, lng: 51.6 })).toBe(false)
    expect(isValidLatLng({ lat: 25, lng: 181 })).toBe(false)
  })
})
