import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Signed booking-lookup tokens.
 *
 * A booking holds a phone number, a flight number and a home address. Medusa
 * order ids are ULIDs and not guessable, but the confirmation page is also
 * reached from an email link that lives in inboxes for years — so the page is
 * gated by an HMAC of the order id, not by the id alone. No account, no
 * password: the link IS the credential.
 *
 * The same secret signs the link in the confirmation email (backend) and
 * verifies it here (storefront), so BOOKING_TOKEN_SECRET must be set
 * identically in both apps' environments. That is deliberate — it is the
 * least machinery that keeps the secret off the client.
 *
 * "server-only" so this can never be bundled into the browser.
 */

function secret(): string {
  const s = process.env.BOOKING_TOKEN_SECRET
  if (!s || s.length < 16) {
    throw new Error(
      "BOOKING_TOKEN_SECRET is not set (or is too short). Generate one with " +
        "`openssl rand -base64 32` and set it in BOTH the backend and the " +
        "storefront environment."
    )
  }
  return s
}

/** URL-safe base64, no padding — it travels in a query string. */
function sign(orderId: string): string {
  return createHmac("sha256", secret()).update(orderId).digest("base64url")
}

export function signBookingToken(orderId: string): string {
  return sign(orderId)
}

/**
 * Constant-time comparison. A plain `===` leaks how many leading bytes matched
 * through timing, which is enough to forge a token byte by byte.
 */
export function verifyBookingToken(orderId: string, token: string | undefined | null): boolean {
  if (!token) return false
  const expected = Buffer.from(sign(orderId))
  const given = Buffer.from(token)
  if (expected.length !== given.length) return false
  return timingSafeEqual(expected, given)
}
