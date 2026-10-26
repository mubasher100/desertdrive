/**
 * What the owner's booking buttons do, as rules on the order's metadata.
 *
 * A booking's own state lives on `metadata.booking_status` — absent while the
 * booking stands, "cancelled" once the owner cancels it — beside the trip it
 * describes. There is no confirm step: a paid booking IS confirmed (owner,
 * 26 Oct 2026); driver allocation happens by hand once the office email lands. Not Medusa's order status, on
 * purpose: Medusa's cancel refunds captured payments through the payment
 * provider, and SkipCash refunds are issued in the merchant portal, never
 * through the API (the provider refuses them). So a paid booking can never be
 * cancelled the Medusa way, and these are the owner's own records instead.
 *
 * Refunds are RECORDED here, not sent: the money goes back in the SkipCash
 * portal, then the owner records it. Nothing on this side moves money.
 *
 * Pure, so every rule is unit-tested without an order, a cart or a database.
 */

export type BookingStatus = "active" | "cancelled"
export type BookingAction = "cancel"

export type RefundRecord = { amount: number; at: string; by: string | null; note: string | null }

export class BookingRuleError extends Error {}

export function statusOf(metadata: Record<string, unknown> | null | undefined): BookingStatus {
  return metadata?.booking_status === "cancelled" ? "cancelled" : "active"
}

export function refundsOf(metadata: Record<string, unknown> | null | undefined): RefundRecord[] {
  const r = metadata?.refunds
  return Array.isArray(r)
    ? r.filter((x): x is RefundRecord => !!x && typeof (x as RefundRecord).amount === "number")
    : []
}

export function refundedTotal(metadata: Record<string, unknown> | null | undefined): number {
  return Math.round(refundsOf(metadata).reduce((sum, r) => sum + r.amount, 0) * 100) / 100
}

/** The metadata after Cancel, or a BookingRuleError saying why not. */
export function applyBookingAction(
  metadata: Record<string, unknown> | null | undefined,
  action: BookingAction,
  by: string | null,
  now: Date,
  reason?: string | null
): Record<string, unknown> {
  const current = statusOf(metadata)
  const base = { ...(metadata ?? {}) }

  if (current === "cancelled") throw new BookingRuleError("This booking is already cancelled.")
  return {
    ...base,
    booking_status: "cancelled",
    cancelled_at: now.toISOString(),
    cancelled_by: by,
    cancel_reason: reason?.trim() ? reason.trim().slice(0, 300) : null,
  }
}

/**
 * The metadata after recording a refund the owner has ALREADY made in the
 * SkipCash portal. Never more than was paid, across every refund recorded.
 */
export function recordRefund(
  metadata: Record<string, unknown> | null | undefined,
  amount: number,
  paidTotal: number,
  by: string | null,
  now: Date,
  note?: string | null
): Record<string, unknown> {
  const amt = Math.round(amount * 100) / 100
  if (!Number.isFinite(amt) || amt <= 0) throw new BookingRuleError("Enter the amount you refunded.")
  const already = refundedTotal(metadata)
  const left = Math.round((paidTotal - already) * 100) / 100
  if (amt > left + 0.001) {
    throw new BookingRuleError(
      left <= 0 ? "This booking has already been refunded in full." : `You can record at most ${left} QAR — the rest has already been refunded.`
    )
  }
  const refunds: RefundRecord[] = [
    ...refundsOf(metadata),
    { amount: amt, at: now.toISOString(), by, note: note?.trim() ? note.trim().slice(0, 300) : null },
  ]
  return { ...(metadata ?? {}), refunds, refunded_total: Math.round((already + amt) * 100) / 100 }
}
