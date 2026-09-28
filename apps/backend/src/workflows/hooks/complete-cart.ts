import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { completionProblem } from "../../lib/completion-rules"

/**
 * Two rules every order must pass, enforced at cart completion because that is
 * the one step EVERY path to an order goes through — our funnel, or anyone
 * calling Medusa's public Store API by hand. A rule that lives only in the
 * storefront is a suggestion; these are the gates.
 *
 * 1 · CARD ONLY. Cash to the driver was removed on 27 Sept 2026, but only its
 *     BUTTON was removed. The region still offers the manual provider
 *     (pp_system_default), and completing a cart with it creates a confirmed
 *     booking with no money taken at all — for any vehicle, by anyone with a
 *     curl command. Verified against a local backend before this was written.
 *     Draft orders the owner creates in the admin do not pass through this
 *     workflow, so phone bookings are unaffected.
 *
 * 2 · NO 1 QAR BOOKING WITHOUT THE OWNER'S KEY. The test vehicle is a
 *     PUBLISHED product so that a test exercises the real cart, SkipCash and
 *     email path. `/store/quotes` only offers it to a caller holding
 *     TEST_BOOKING_KEY — but a quote is advice, not a gate, and the public
 *     Store API will cart any published variant. Fails closed: with the key
 *     unset, no cart holding the test vehicle can ever complete.
 */
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // The hook container is loosely typed, so the query service is narrowed explicitly.
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Omit<RemoteQueryFunction, symbol>
  const cartId = (cart as { id: string }).id

  const { data: rows } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "metadata",
      "items.product.metadata",
      "payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: cartId },
  })

  const row = rows?.[0] as
    | {
        metadata?: Record<string, unknown> | null
        items?: Array<{ product?: { metadata?: Record<string, unknown> | null } | null }>
        payment_collection?: { payment_sessions?: Array<{ provider_id?: string }> } | null
      }
    | undefined

  const problem = completionProblem({
    providers: (row?.payment_collection?.payment_sessions ?? []).map((s) => s.provider_id),
    holdsTestVehicle: (row?.items ?? []).some((i) => i.product?.metadata?.test_only),
    proof: row?.metadata?.test_proof,
    key: process.env.TEST_BOOKING_KEY,
  })

  if (problem === "not-card") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Bookings must be paid by card.")
  }
  if (problem === "test-without-key") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This vehicle is not available to book.")
  }
})
