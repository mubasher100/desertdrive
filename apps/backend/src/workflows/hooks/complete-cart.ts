import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { completionProblem } from "../../lib/completion-rules"
import { minLeadMinutesFor } from "../../lib/fare-units"

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
 *
 * 3 · THE TRIP'S OWN RULES. At least 6 hours' notice, and the short-notice
 *     fare (2× under 12 hours) actually on the vehicle line. Judged against
 *     the cart's creation time, not now: on the card path completion runs
 *     AFTER the charge, and a customer who sat on the payment page across the
 *     12-hour line has already paid the price they were shown.
 */
completeCartWorkflow.hooks.validate(async ({ cart }, { container }) => {
  // The hook container is loosely typed, so the query service is narrowed explicitly.
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as Omit<RemoteQueryFunction, symbol>
  const cartId = (cart as { id: string }).id

  const { data: rows } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "created_at",
      "metadata",
      "items.quantity",
      "items.product.handle",
      "items.product.metadata",
      "payment_collection.payment_sessions.provider_id",
    ],
    filters: { id: cartId },
  })

  const row = rows?.[0] as
    | {
        created_at?: string | Date
        metadata?: Record<string, unknown> | null
        items?: Array<{ quantity?: number; product?: { handle?: string; metadata?: Record<string, unknown> | null } | null }>
        payment_collection?: { payment_sessions?: Array<{ provider_id?: string }> } | null
      }
    | undefined

  // The vehicle is the line whose product declares a capacity; add-ons and
  // anything else in the cart do not.
  const vehicleLine = (row?.items ?? []).find(
    (i) => i.product?.metadata?.passengers != null && !i.product?.metadata?.add_on
  )

  const problem = completionProblem({
    providers: (row?.payment_collection?.payment_sessions ?? []).map((s) => s.provider_id),
    holdsTestVehicle: (row?.items ?? []).some((i) => i.product?.metadata?.test_only),
    proof: row?.metadata?.test_proof,
    key: process.env.TEST_BOOKING_KEY,
    trip: vehicleLine
      ? {
          pickupAt: row?.metadata?.pickup_at,
          returnAt: row?.metadata?.return_at,
          quantity: Number(vehicleLine.quantity ?? 0),
          createdAt: new Date(row?.created_at ?? Date.now()),
          // 24 hours for the luxury classes, 12 for the rest.
          minLeadMinutes: minLeadMinutesFor(vehicleLine.product?.handle, vehicleLine.product?.metadata),
        }
      : undefined,
  })

  if (problem === "not-card") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Bookings must be paid by card.")
  }
  if (problem === "no-trip") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "This booking has no pickup time.")
  }
  if (problem === "too-soon") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This pickup is too soon to book online for this vehicle. Please choose a later time.")
  }
  if (problem === "under-priced") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "The fare for this pickup time has changed. Please search again.")
  }
  if (problem === "test-without-key") {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This vehicle is not available to book.")
  }
})
