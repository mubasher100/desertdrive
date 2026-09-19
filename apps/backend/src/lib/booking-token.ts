import { createHmac } from "node:crypto"

/**
 * Signs the booking-lookup link that goes in the confirmation email.
 *
 * HMAC-SHA256 of the order id, base64url. The storefront verifies it with the
 * SAME secret (apps/storefront/src/lib/booking/token.ts) — BOOKING_TOKEN_SECRET
 * must be identical on both apps, or every email link lands on "not found".
 */
export function signBookingToken(orderId: string): string {
  const secret = process.env.BOOKING_TOKEN_SECRET
  if (!secret || secret.length < 16) {
    throw new Error("BOOKING_TOKEN_SECRET is not set (or is too short) — the confirmation email link cannot be signed.")
  }
  return createHmac("sha256", secret).update(orderId).digest("base64url")
}

export function bookingLookupUrl(orderId: string, locale: string): string {
  const base = (process.env.STOREFRONT_URL || "http://localhost:8000").replace(/\/$/, "")
  return `${base}/${locale}/confirmed/${orderId}?t=${signBookingToken(orderId)}`
}
