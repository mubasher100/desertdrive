import type { NotificationRow } from "./booking-email-status"

/**
 * The rules behind jobs/booking-safety-net.ts — what to send again, and when a
 * payment has been taken without a booking — kept free of Medusa so they are
 * unit-tested on their own.
 *
 * Owner's rule (18 Nov 2026): the emails must come through, no matter what.
 * order.placed sends them once. If Resend is down, rate-limits, or the process
 * restarts before the subscriber runs, that one try was the only try. This is
 * every try after it.
 */

export type EmailKind = "customer" | "office"

const TEMPLATE: Record<EmailKind, string> = {
  customer: "booking-confirmation",
  office: "booking-owner-alert",
}

/**
 * Minutes to wait after attempt n before attempt n + 1. Ten tries over about a
 * day: quick at first, for a blip, then spaced out, for an outage. The job runs
 * every five minutes, so anything shorter than five is five.
 */
export const RETRY_AFTER_MINUTES = [5, 5, 10, 20, 40, 60, 120, 240, 480]
export const MAX_ATTEMPTS = RETRY_AFTER_MINUTES.length + 1

/** A send still "pending" this long after it started died with its process. */
export const STUCK_PENDING_MINUTES = 10

/** order.placed is given this long to do its own job before the net steps in. */
export const GRACE_MINUTES = 5

/**
 * Bookings before email was recorded against its order (PR #72, 18 Nov 2026
 * 02:23 UTC) have no rows at all — "no record" there means "before records",
 * not "never sent", and must not trigger a confirmation weeks late.
 */
export const EMAIL_RECORDS_FROM = new Date("2026-11-18T02:30:00Z")

/** After the pickup, an email helps nobody; stop trying an hour past it. */
export const AFTER_PICKUP_MINUTES = 60

export type RetryDecision = {
  /** Emails to send now. */
  send: EmailKind[]
  /** Nothing about this booking was ever sent — announce it as new. */
  announce: boolean
  /** Emails on their last try: say so loudly if this one fails too. */
  lastTry: EmailKind[]
}

export function emailsToRetry(
  order: { created_at: string | Date; pickup_at?: unknown; has_customer_email: boolean },
  rows: NotificationRow[],
  now: Date
): RetryDecision {
  const none: RetryDecision = { send: [], announce: false, lastTry: [] }
  const created = new Date(order.created_at).getTime()
  if (Number.isNaN(created) || created < EMAIL_RECORDS_FROM.getTime()) return none
  if (now.getTime() - created < GRACE_MINUTES * 60_000) return none

  const pickup = typeof order.pickup_at === "string" ? new Date(order.pickup_at).getTime() : NaN
  if (!Number.isNaN(pickup) && now.getTime() > pickup + AFTER_PICKUP_MINUTES * 60_000) return none

  const kinds: EmailKind[] = order.has_customer_email ? ["customer", "office"] : ["office"]
  const send: EmailKind[] = []
  const lastTry: EmailKind[] = []
  let neverTried = 0

  for (const kind of kinds) {
    const attempts = rows
      .filter((r) => r.channel === "email" && r.template === TEMPLATE[kind])
      .sort((a, b) => time(b.created_at) - time(a.created_at))
    if (!attempts.length) {
      neverTried++
      send.push(kind)
      continue
    }
    const latest = attempts[0]
    if (latest.status === "success") continue
    if (attempts.some((a) => a.status === "success")) continue
    const minutesSince = (now.getTime() - time(latest.created_at)) / 60_000
    const failed = latest.status === "failure" || minutesSince >= STUCK_PENDING_MINUTES
    if (!failed) continue
    if (attempts.length >= MAX_ATTEMPTS) continue
    if (minutesSince < RETRY_AFTER_MINUTES[attempts.length - 1]) continue
    send.push(kind)
    if (attempts.length + 1 >= MAX_ATTEMPTS) lastTry.push(kind)
  }

  return { send, announce: neverTried === kinds.length, lastTry }
}

/** Where a payment session stands, as far as the watchdog needs to know. */
export type SessionLike = {
  provider_id?: string | null
  status?: string | null
  created_at: string | Date
  data?: Record<string, unknown> | null
}

/** A checkout is only judged once the customer has had time to pay and come back. */
export const PAID_CHECK_AFTER_MINUTES = 15
/** …and only for a while: a SkipCash page left open for six hours was abandoned. */
export const PAID_CHECK_UNTIL_HOURS = 6

/**
 * The SkipCash sessions on an unfinished cart that are worth asking about.
 * Medusa already knows some are paid (authorized / captured); the rest are
 * asked of SkipCash, which is the only one that knows whether a customer who
 * closed the tab on the payment page was charged.
 */
export function sessionsToCheck(sessions: SessionLike[], now: Date): SessionLike[] {
  return sessions.filter((s) => {
    if (!String(s.provider_id ?? "").includes("skipcash")) return false
    const age = (now.getTime() - time(s.created_at)) / 60_000
    if (age < PAID_CHECK_AFTER_MINUTES || age > PAID_CHECK_UNTIL_HOURS * 60) return false
    if (s.status === "authorized" || s.status === "captured") return true
    if (s.status === "canceled" || s.status === "error") return false
    return typeof s.data?.skipcash_id === "string" && s.data.skipcash_id.length > 0
  })
}

function time(v: string | Date): number {
  return new Date(v).getTime()
}
