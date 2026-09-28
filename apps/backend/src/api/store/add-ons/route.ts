import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listAddOnsWorkflow } from "../../../workflows/add-ons/list-add-ons"

/**
 * GET /store/add-ons
 *
 * The extras a customer can add to a booking, priced in QAR by the server.
 *
 * HTTP only: the workflow decides what is on offer and what it costs. The
 * client never sends a price, and the cart re-checks every add-on against this
 * same source before charging for it.
 *
 * Cacheable — unlike a quote, this is the same answer for everyone, and it is
 * the catalogue rather than anybody's trip. Short, because the guarantee is
 * "an admin price change is live within the cache window".
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const { result } = await listAddOnsWorkflow(_req.scope).run({})

  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")

  // An empty list is a valid answer: nothing is priced yet. The storefront
  // renders no add-on section at all rather than an empty heading.
  res.json({ add_ons: result })
}
