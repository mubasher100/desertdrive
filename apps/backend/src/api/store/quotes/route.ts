import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveQuoteWorkflow } from "../../../workflows/quotes/resolve-quote"
import type { CreateQuoteSchema } from "./middlewares"

/**
 * POST /store/quotes
 *
 * Returns the fare bands and priced vehicle options for a destination.
 *
 * HTTP only: validation happens in the middleware, business logic in the
 * workflow. Nothing here decides anything.
 *
 * ⚠️ This response must NEVER be cached. A quote is tied to one person's
 * coordinates and one person's party size — there is nothing to win by caching
 * it, and both correctness and privacy to lose. The no-store header below is the
 * server half of that; the storefront's fetch must also pass `no-store`.
 */
export async function POST(
  req: MedusaRequest<CreateQuoteSchema>,
  res: MedusaResponse
) {
  const { lat, lng, passengers, luggage, pickup_at, return_at } = req.validatedBody

  const { result } = await resolveQuoteWorkflow(req.scope).run({
    input: { lat, lng, passengers, luggage, pickup_at: pickup_at ?? null, return_at: return_at ?? null },
  })

  res.setHeader("Cache-Control", "no-store")

  /**
   * An empty vehicle list is a valid, expected answer: it means the trip
   * resolves to a band the owner has not priced yet. The storefront shows
   * "contact us for a quote" rather than an error, and certainly rather than a
   * guessed fare.
   */
  res.json({
    distance_km: result.distance_km,
    band: result.band,
    vehicles: result.vehicles,
    quotable: result.vehicles.length > 0,
    available: result.vehicles.some((v) => v.available),
  })
}
