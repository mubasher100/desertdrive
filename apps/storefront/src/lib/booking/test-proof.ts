import { createHash } from "crypto"

/**
 * A one-way stand-in for the owner's test key, written onto the cart so the
 * backend can refuse to complete a 1 QAR test booking without it.
 *
 * Server-only (it is called from a server action). Mirrors
 * apps/backend/src/lib/test-proof.ts — the two must produce the same string.
 */
export function testProof(key: string): string {
  return createHash("sha256").update(`desertdrive-test-booking:${key}`).digest("hex")
}
