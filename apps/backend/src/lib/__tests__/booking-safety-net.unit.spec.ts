import { emailsToRetry, sessionsToCheck, MAX_ATTEMPTS } from "../booking-safety-net"
import type { NotificationRow } from "../booking-email-status"

const NOW = new Date("2026-11-20T10:00:00Z")
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString()
const order = (over: Partial<{ created_at: string; pickup_at: unknown; has_customer_email: boolean }> = {}) => ({
  created_at: ago(30),
  pickup_at: "2026-11-21T10:00:00+03:00",
  has_customer_email: true,
  ...over,
})
let n = 0
const row = (template: string, status: string, minutesAgo: number): NotificationRow => ({
  id: `n${n++}`,
  to: "x@example.com",
  channel: "email",
  template,
  status,
  created_at: ago(minutesAgo),
})
const C = "booking-confirmation"
const O = "booking-owner-alert"

describe("emailsToRetry", () => {
  it("leaves a booking whose emails both went", () => {
    expect(emailsToRetry(order(), [row(C, "success", 29), row(O, "success", 29)], NOW).send).toEqual([])
  })

  it("resends only the email that failed", () => {
    const d = emailsToRetry(order(), [row(C, "failure", 29), row(O, "success", 29)], NOW)
    expect(d.send).toEqual(["customer"])
    expect(d.announce).toBe(false)
  })

  it("announces a booking nothing was ever sent for — the event was lost", () => {
    const d = emailsToRetry(order(), [], NOW)
    expect(d.send).toEqual(["customer", "office"])
    expect(d.announce).toBe(true)
  })

  it("gives order.placed its own five minutes first", () => {
    expect(emailsToRetry(order({ created_at: ago(2) }), [], NOW).send).toEqual([])
  })

  it("never touches a booking from before emails were recorded (DD-13 and earlier)", () => {
    expect(emailsToRetry(order({ created_at: "2026-11-17T20:00:00Z" }), [], NOW).send).toEqual([])
  })

  it("stops an hour after the pickup", () => {
    const d = emailsToRetry(order({ pickup_at: ago(61) }), [row(C, "failure", 29)], NOW)
    expect(d.send).toEqual([])
  })

  it("backs off between tries", () => {
    // Two failures, the last four minutes ago: the wait after the 2nd is 5 min.
    expect(emailsToRetry(order(), [row(C, "failure", 20), row(C, "failure", 4), row(O, "success", 29)], NOW).send).toEqual([])
    expect(emailsToRetry(order(), [row(C, "failure", 20), row(C, "failure", 6), row(O, "success", 29)], NOW).send).toEqual(["customer"])
  })

  it("treats a send stuck at pending as dead after ten minutes", () => {
    expect(emailsToRetry(order(), [row(C, "pending", 5), row(O, "success", 29)], NOW).send).toEqual([])
    expect(emailsToRetry(order(), [row(C, "pending", 11), row(O, "success", 29)], NOW).send).toEqual(["customer"])
  })

  it("stops after the last try, and flags the last one", () => {
    const tries = (k: number) => Array.from({ length: k }, (_, i) => row(C, "failure", 2000 - i))
    const last = emailsToRetry(order({ created_at: ago(2100) }), [...tries(MAX_ATTEMPTS - 1), row(O, "success", 2000)], NOW)
    expect(last.send).toEqual(["customer"])
    expect(last.lastTry).toEqual(["customer"])
    expect(emailsToRetry(order({ created_at: ago(2100) }), [...tries(MAX_ATTEMPTS), row(O, "success", 2000)], NOW).send).toEqual([])
  })

  it("does not chase a customer with no email address", () => {
    expect(emailsToRetry(order({ has_customer_email: false }), [row(O, "success", 29)], NOW).send).toEqual([])
  })

  it("a later success settles an earlier failure", () => {
    expect(emailsToRetry(order(), [row(C, "failure", 29), row(C, "success", 20), row(O, "success", 29)], NOW).send).toEqual([])
  })
})

describe("sessionsToCheck", () => {
  const s = (over: Record<string, unknown>) => ({
    provider_id: "pp_skipcash_skipcash",
    status: "pending",
    created_at: ago(30),
    data: { skipcash_id: "sc_1" },
    ...over,
  })

  it("asks about a SkipCash session left pending past fifteen minutes", () => {
    expect(sessionsToCheck([s({})], NOW)).toHaveLength(1)
  })

  it("waits for the customer to come back first", () => {
    expect(sessionsToCheck([s({ created_at: ago(10) })], NOW)).toHaveLength(0)
  })

  it("gives up on a payment page left open for six hours", () => {
    expect(sessionsToCheck([s({ created_at: ago(6 * 60 + 1) })], NOW)).toHaveLength(0)
  })

  it("counts a session Medusa already knows is paid", () => {
    expect(sessionsToCheck([s({ status: "captured", data: {} })], NOW)).toHaveLength(1)
  })

  it("ignores other providers, failures and sessions SkipCash never created", () => {
    expect(
      sessionsToCheck([s({ provider_id: "pp_system_default" }), s({ status: "error" }), s({ data: {} })], NOW)
    ).toHaveLength(0)
  })
})
