import { applyBookingAction, recordRefund, refundedTotal, statusOf } from "../booking-status"

const NOW = new Date("2026-10-21T10:00:00Z")

describe("booking buttons", () => {
  it("treats a booking with no status as new — every order before the buttons", () => {
    expect(statusOf({ pickup_at: "x" })).toBe("new")
  })

  it("confirms a new booking", () => {
    const m = applyBookingAction({ pickup_at: "x" }, "confirm", "user_1", NOW)
    expect(m).toMatchObject({ booking_status: "confirmed", confirmed_by: "user_1", pickup_at: "x" })
  })

  it("does not confirm twice, or confirm a cancelled booking", () => {
    expect(() => applyBookingAction({ booking_status: "confirmed" }, "confirm", null, NOW)).toThrow(/already confirmed/)
    expect(() => applyBookingAction({ booking_status: "cancelled" }, "confirm", null, NOW)).toThrow(/cancelled/)
  })

  it("cancels new or confirmed bookings, keeping the trip", () => {
    const m = applyBookingAction({ booking_status: "confirmed", address: "Mondrian" }, "cancel", "u", NOW, "  flight cancelled ")
    expect(m).toMatchObject({ booking_status: "cancelled", address: "Mondrian", cancel_reason: "flight cancelled" })
    expect(() => applyBookingAction(m, "cancel", "u", NOW)).toThrow(/already cancelled/)
  })
})

describe("recording refunds", () => {
  it("records a partial refund, then the rest", () => {
    const a = recordRefund({}, 100, 254.6, "u", NOW)
    expect(refundedTotal(a)).toBe(100)
    const b = recordRefund(a, 154.6, 254.6, "u", NOW)
    expect(refundedTotal(b)).toBe(254.6)
  })

  it("never records more than was paid, across refunds", () => {
    const a = recordRefund({}, 200, 254.6, "u", NOW)
    expect(() => recordRefund(a, 60, 254.6, "u", NOW)).toThrow(/at most 54.6/)
    const full = recordRefund({}, 254.6, 254.6, "u", NOW)
    expect(() => recordRefund(full, 1, 254.6, "u", NOW)).toThrow(/refunded in full/)
  })

  it("refuses zero and nonsense", () => {
    expect(() => recordRefund({}, 0, 100, "u", NOW)).toThrow()
    expect(() => recordRefund({}, Number.NaN, 100, "u", NOW)).toThrow()
  })
})

