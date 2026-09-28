import { createHash } from "crypto"

/**
 * A one-way stand-in for TEST_BOOKING_KEY, safe to leave on a cart.
 *
 * The storefront writes this onto the cart when the owner books through
 * `?test=<key>`; cart completion recomputes it from the real key and compares.
 * A hash rather than the key itself, because cart metadata is copied onto the
 * order and shows in the admin forever — the proof should not be the secret.
 *
 * Mirrored in apps/storefront/src/lib/booking/test-proof.ts. The two MUST
 * produce the same string or every test booking is refused.
 */
export function testProof(key: string): string {
  return createHash("sha256").update(`desertdrive-test-booking:${key}`).digest("hex")
}
