import { fareUnits, meetsLeadTime, minLeadMinutesFor, unitsForLeg } from "../fare-units"
import { CARD_PROVIDER, completionProblem, NOTICE_RULES_FROM, SHORT_NOTICE_ENFORCED_FROM } from "../completion-rules"

/**
 * The blocks below were written for the 28 Sept rules — 6-hour minimum, 2×
 * under 12 hours — and still run under them, set explicitly. The surcharge is
 * OFF by default since 30 Sept, but its machinery is kept for the owner to
 * switch back on, and these prove it still works when they do. Today's
 * defaults are tested at the bottom of the file.
 */
const ENV = ["MIN_LEAD_MINUTES", "SURGE_WINDOW_MINUTES", "SURGE_MULTIPLIER"] as const
const withOldRules = () => {
  beforeAll(() => { process.env.MIN_LEAD_MINUTES = "360"; process.env.SURGE_WINDOW_MINUTES = "720"; process.env.SURGE_MULTIPLIER = "2" })
  afterAll(() => { for (const k of ENV) delete process.env[k] })
}

const NOW = new Date("2026-10-01T06:00:00Z")
const inHours = (h: number) => new Date(NOW.getTime() + h * 3_600_000).toISOString()

describe("unitsForLeg — the owner's 12-hour rule", () => {
  withOldRules()
  it("charges one fare with 12 hours' notice or more", () => {
    expect(unitsForLeg(inHours(12), NOW)).toBe(1)
    expect(unitsForLeg(inHours(48), NOW)).toBe(1)
  })

  it("charges two fares under 12 hours", () => {
    expect(unitsForLeg(inHours(11.99), NOW)).toBe(2)
    expect(unitsForLeg(inHours(6), NOW)).toBe(2)
  })

  /** The owner chose the cliff knowingly; this pins it so it is not "fixed" by accident. */
  it("has a cliff at exactly 12 hours", () => {
    expect(unitsForLeg(new Date(NOW.getTime() + 12 * 3_600_000 - 60_000).toISOString(), NOW)).toBe(2)
    expect(unitsForLeg(new Date(NOW.getTime() + 12 * 3_600_000).toISOString(), NOW)).toBe(1)
  })
})

describe("fareUnits", () => {
  withOldRules()
  it("is one unit for a one-way with plenty of notice", () => {
    expect(fareUnits(inHours(24), null, NOW)).toMatchObject({ units: 1, legs: 1, surged_legs: 0 })
  })

  it("is two units for a short-notice one-way", () => {
    expect(fareUnits(inHours(8), null, NOW)).toMatchObject({ units: 2, legs: 1, surged_legs: 1 })
  })

  /** Per leg: a return next week is not short notice because the outbound is. */
  it("surges only the short-notice leg of a return", () => {
    expect(fareUnits(inHours(8), inHours(24 * 7), NOW)).toMatchObject({ units: 3, legs: 2, surged_legs: 1 })
  })

  it("surges both legs when both are short notice", () => {
    expect(fareUnits(inHours(7), inHours(11), NOW)).toMatchObject({ units: 4, legs: 2, surged_legs: 2 })
  })

  it("is plain legs when there is no pickup time to judge", () => {
    expect(fareUnits(null, null, NOW)).toMatchObject({ units: 1, legs: 1, surged_legs: 0 })
  })
})

describe("meetsLeadTime — the owner's 6-hour minimum", () => {
  withOldRules()
  it("accepts six hours or more", () => {
    expect(meetsLeadTime(inHours(6), NOW)).toBe(true)
  })
  it("refuses less", () => {
    expect(meetsLeadTime(inHours(5.9), NOW)).toBe(false)
    expect(meetsLeadTime(inHours(-1), NOW)).toBe(false)
  })
  it("refuses an unreadable time rather than treating it as far away", () => {
    expect(meetsLeadTime("not a date", NOW)).toBe(false)
  })
})

describe("completionProblem — the trip rules at the gate", () => {
  withOldRules()
  const after = new Date(SHORT_NOTICE_ENFORCED_FROM.getTime() + 86_400_000)
  const at = (h: number) => new Date(after.getTime() + h * 3_600_000).toISOString()
  const base = { providers: [CARD_PROVIDER], holdsTestVehicle: false, proof: undefined, key: "k" }

  it("accepts a short-notice trip charged at two fares", () => {
    expect(completionProblem({ ...base, trip: { pickupAt: at(8), returnAt: null, quantity: 2, createdAt: after } })).toBeNull()
  })

  it("refuses a short-notice trip charged at one fare", () => {
    expect(completionProblem({ ...base, trip: { pickupAt: at(8), returnAt: null, quantity: 1, createdAt: after } })).toBe("under-priced")
  })

  it("refuses a pickup under six hours away — the storefront was the only thing stopping it", () => {
    expect(completionProblem({ ...base, trip: { pickupAt: at(1), returnAt: null, quantity: 2, createdAt: after } })).toBe("too-soon")
  })

  it("refuses a booking with no pickup time", () => {
    expect(completionProblem({ ...base, trip: { pickupAt: undefined, returnAt: null, quantity: 1, createdAt: after } })).toBe("no-trip")
  })

  /**
   * The quote is taken a moment before the cart is created. A quote at
   * 12h00m01s (one fare) on a cart created just past the line must not be
   * refused — on the card path that refusal lands after the charge.
   */
  it("gives ten minutes of grace around the 12-hour line", () => {
    const created = after
    const pickup = new Date(created.getTime() + 12 * 3_600_000 - 5 * 60_000).toISOString()
    expect(completionProblem({ ...base, trip: { pickupAt: pickup, returnAt: null, quantity: 1, createdAt: created } })).toBeNull()
  })

  /** The deploy race: carts made before both halves were live are not checked for surge. */
  it("does not check the short-notice fare on carts from before enforcement began", () => {
    const early = new Date(SHORT_NOTICE_ENFORCED_FROM.getTime() - 60_000)
    const pickup = new Date(early.getTime() + 8 * 3_600_000).toISOString()
    expect(completionProblem({ ...base, trip: { pickupAt: pickup, returnAt: null, quantity: 1, createdAt: early } })).toBeNull()
  })
})

describe("today's rules (30 Sept 2026) — the defaults", () => {
  beforeAll(() => { for (const k of ENV) delete process.env[k] })

  it("needs 12 hours for a standard car", () => {
    expect(minLeadMinutesFor("sedan")).toBe(720)
    expect(meetsLeadTime(inHours(12), NOW)).toBe(true)
    expect(meetsLeadTime(inHours(11.9), NOW)).toBe(false)
  })

  it("needs 24 hours for the S-Class and the V-Class", () => {
    expect(minLeadMinutesFor("luxury-sedan")).toBe(1440)
    expect(minLeadMinutesFor("luxury-van")).toBe(1440)
    expect(meetsLeadTime(inHours(23), NOW, minLeadMinutesFor("luxury-van"))).toBe(false)
    expect(meetsLeadTime(inHours(24), NOW, minLeadMinutesFor("luxury-van"))).toBe(true)
  })

  it("lets the owner change a class's notice in the admin, never below the standard", () => {
    expect(minLeadMinutesFor("luxury-van", { min_lead_hours: 48 })).toBe(2880)
    expect(minLeadMinutesFor("sedan", { min_lead_hours: 2 })).toBe(720)
  })

  it("charges no short-notice fare — the 2× is off", () => {
    expect(fareUnits(inHours(13), null, NOW).units).toBe(1)
    expect(unitsForLeg(inHours(1), NOW)).toBe(1)
  })

  describe("at the gate", () => {
    const after = new Date(NOTICE_RULES_FROM.getTime() + 86_400_000)
    const at = (h: number) => new Date(after.getTime() + h * 3_600_000).toISOString()
    const base = { providers: [CARD_PROVIDER], holdsTestVehicle: false, proof: undefined, key: "k" }

    it("refuses a standard car under 12 hours", () => {
      expect(completionProblem({ ...base, trip: { pickupAt: at(8), returnAt: null, quantity: 1, createdAt: after, minLeadMinutes: 720 } })).toBe("too-soon")
    })

    it("refuses a luxury car under 24 hours", () => {
      expect(completionProblem({ ...base, trip: { pickupAt: at(20), returnAt: null, quantity: 1, createdAt: after, minLeadMinutes: 1440 } })).toBe("too-soon")
    })

    it("accepts a luxury car at 24 hours", () => {
      expect(completionProblem({ ...base, trip: { pickupAt: at(25), returnAt: null, quantity: 1, createdAt: after, minLeadMinutes: 1440 } })).toBeNull()
    })

    /** Carts sold under the old 6-hour rule before the deploy are not refused after being charged. */
    it("holds carts from before the change to the old 6-hour minimum", () => {
      const early = new Date(NOTICE_RULES_FROM.getTime() - 60_000)
      const pickup = new Date(early.getTime() + 8 * 3_600_000).toISOString()
      expect(completionProblem({ ...base, trip: { pickupAt: pickup, returnAt: null, quantity: 1, createdAt: early, minLeadMinutes: 1440 } })).toBeNull()
    })
  })
})
