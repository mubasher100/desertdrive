import { testProof } from "./test-proof"

/** The only payment provider a customer may complete a booking with. */
export const CARD_PROVIDER = "pp_skipcash_skipcash"

export type CompletionFacts = {
  /** Provider of every payment session on the cart. */
  providers: Array<string | undefined>
  /** Whether any line is the 1 QAR test vehicle. */
  holdsTestVehicle: boolean
  /** `cart.metadata.test_proof`, as found. */
  proof: unknown
  /** TEST_BOOKING_KEY, as configured. Unset means test bookings are impossible. */
  key: string | undefined
}

/**
 * Why a cart may not become an order, or null if it may. Pure, so the gate
 * can be tested without standing up a cart, a payment and a region.
 */
export function completionProblem(f: CompletionFacts): "not-card" | "test-without-key" | null {
  if (f.providers.some((p) => p !== CARD_PROVIDER)) return "not-card"
  if (f.holdsTestVehicle && (!f.key || typeof f.proof !== "string" || f.proof !== testProof(f.key))) {
    return "test-without-key"
  }
  return null
}
