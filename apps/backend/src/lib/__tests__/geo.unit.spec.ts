import { haversineKm, resolveBand, isValidLatLng, type BandBounds } from "../geo"

/** Hamad International airport reference point (25°16′23″N 51°36′29″E). */
const DOH = { lat: 25.273056, lng: 51.608056 }

/**
 * The band table as seeded. Kept in sync with seed-fleet.ts by the calibration
 * test below — if the seed bounds move, these expectations fail loudly.
 */
const BANDS: BandBounds[] = [
  { code: "A", max_km: 20, rank: 1 },
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
    ["Lusail Marina", 25.4106, 51.4914, 19.3, "A"],
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
   * ⚠️ Lusail Marina sits 0.7 km inside the A/B boundary. Northern Lusail is
   * past it, so two addresses a customer would both call "Lusail" can price
   * differently. This is a live commercial decision for the owner, not a bug —
   * this test exists to make sure nobody discovers it from a complaint.
   */
  it("documents how little headroom Lusail has inside band A", () => {
    const lusailMarina = haversineKm(DOH, { lat: 25.4106, lng: 51.4914 })
    const northLusail = haversineKm(DOH, { lat: 25.4462, lng: 51.4914 })

    expect(20 - lusailMarina).toBeLessThan(1)
    expect(resolveBand(lusailMarina, BANDS)?.code).toBe("A")
    expect(resolveBand(northLusail, BANDS)?.code).toBe("B")
  })
})

describe("resolveBand", () => {
  it("picks the first band by rank whose bound is not exceeded", () => {
    expect(resolveBand(0, BANDS)?.code).toBe("A")
    expect(resolveBand(19.99, BANDS)?.code).toBe("A")
  })

  it("treats max_km as inclusive", () => {
    expect(resolveBand(20, BANDS)?.code).toBe("A")
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
