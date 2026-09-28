import { BAND_TIERS, qarFromUsd, TIERS, usdFromOwnerQar, ZONES } from "../../data/price-book"
import { pointInRing } from "../geo"

/** The zone a point prices by: the lowest-ranked active outline containing it. */
function zoneFor(p: { lat: number; lng: number }) {
  return [...ZONES].sort((a, b) => a.rank - b.rank).find((z) => pointInRing(p, z.polygon))?.code ?? null
}

describe("price book — whole dollars", () => {
  it("rounds the owner's riyals UP to the next dollar, never down", () => {
    expect(usdFromOwnerQar(60)).toBe(17) // 16.48
    expect(usdFromOwnerQar(150)).toBe(42) // 41.21
    expect(usdFromOwnerQar(750)).toBe(207) // 206.04
  })

  it("does not push an exact dollar up a dollar through float noise", () => {
    expect(usdFromOwnerQar(182)).toBe(50) // exactly $50
    expect(usdFromOwnerQar(18.2)).toBe(5)
  })

  it("charges the exact riyal equivalent, to the fils", () => {
    expect(qarFromUsd(17)).toBe(61.88)
    expect(qarFromUsd(5)).toBe(18.2)
    expect(qarFromUsd(344)).toBe(1252.16)
  })

  it("never prices below what the owner set", () => {
    for (const tier of Object.values(TIERS)) {
      for (const usd of Object.values(tier)) {
        expect(Number.isInteger(usd)).toBe(true)
      }
    }
    expect(qarFromUsd(TIERS.downtown.sedan)).toBeGreaterThanOrEqual(60)
    expect(qarFromUsd(TIERS.resorts["luxury-van"])).toBeGreaterThanOrEqual(1250)
  })
})

describe("price book — the owner's list", () => {
  it("has the owner's standard fares", () => {
    expect(TIERS.downtown).toMatchObject({ sedan: 17, suv: 22, "large-van": 42 })
    expect(TIERS.westBay).toMatchObject({ sedan: 22, suv: 28, "large-van": 50 })
    expect(TIERS.pearl).toMatchObject({ sedan: 28, suv: 42, "large-van": 61 })
    expect(TIERS.northLusail).toMatchObject({ sedan: 42, suv: 61, "large-van": 77 })
    expect(TIERS.educationCity).toMatchObject({ sedan: 42, suv: 61, "large-van": 77 })
    expect(TIERS.resorts).toMatchObject({ sedan: 97, suv: 138, "large-van": 207 })
  })

  /** Luxury = Downtown's luxury price plus the area's uplift, per the owner. */
  it("adds each area's uplift to Downtown's luxury prices", () => {
    const pairs: Array<[keyof typeof TIERS, number]> = [
      ["downtown", 0], ["westBay", 100], ["pearl", 200], ["northLusail", 300], ["educationCity", 400], ["resorts", 500],
    ]
    for (const [name, up] of pairs) {
      expect(TIERS[name]["luxury-sedan"]).toBe(usdFromOwnerQar(650 + up))
      expect(TIERS[name]["luxury-van"]).toBe(usdFromOwnerQar(750 + up))
    }
  })

  it("prices the distance rings like their nearest named area", () => {
    expect(BAND_TIERS.A).toBe(TIERS.westBay)
    expect(BAND_TIERS.B).toBe(TIERS.northLusail)
    expect(BAND_TIERS.D).toBe(TIERS.resorts)
    // the one ring with no named place sits between its neighbours
    for (const k of Object.keys(BAND_TIERS.C) as Array<keyof typeof BAND_TIERS.C>) {
      expect(BAND_TIERS.C[k]).toBeGreaterThan(BAND_TIERS.B[k])
      expect(BAND_TIERS.C[k]).toBeLessThan(BAND_TIERS.D[k])
    }
  })
})

describe("price book — outlines", () => {
  it("uses a unique code per area", () => {
    expect(new Set(ZONES.map((z) => z.code)).size).toBe(ZONES.length)
  })

  /**
   * Every named hotel resolves to its OWN area once ranks are applied — not
   * merely "inside some outline". A hotel pricing as the wrong area is a wrong
   * fare, silently, on the very places the owner said matter most.
   */
  for (const zone of ZONES) {
    for (const a of zone.anchors) {
      it(`${a.name} prices as ${zone.name_en}`, () => {
        expect(zoneFor(a)).toBe(zone.code)
      })
    }
  }

  it("leaves the airport itself and Al Wakrah to the distance bands", () => {
    expect(zoneFor({ lat: 25.2731, lng: 51.6081 })).toBeNull()
    expect(zoneFor({ lat: 25.1567, lng: 51.6013 })).toBeNull()
  })

  it("keeps other well-known hotels in the area a guest would expect", () => {
    expect(zoneFor({ lat: 25.3274, lng: 51.5331 })).toBe("WESTBAY") // Waldorf Astoria West Bay
    expect(zoneFor({ lat: 25.3286, lng: 51.531 })).toBe("WESTBAY") // Kempinski Residences
    expect(zoneFor({ lat: 25.2838, lng: 51.5406 })).toBe("DOWNTOWN") // Embassy Suites Old Town
    expect(zoneFor({ lat: 25.3692, lng: 51.5441 })).toBe("PEARL") // St. Regis Marsa Arabia
  })
})
